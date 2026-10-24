import { z } from "zod";
import type { ApiClient } from "../api/client";
import { type UserKeys, zUserKeys } from "../api/schemas";
import { canonical } from "../crypto/canonical";
import { verify } from "../crypto/ed25519";
import type { RecipientDevice } from "../crypto/envelope";
import type { PinnedIdentity } from "../model/types";
import type { LocalStore } from "../store/db";

/**
 * Who to encrypt to and whom to believe (android data/repo/Directory.kt, docs/SECURITY.md §3):
 * - a person's identity key is pinned on first contact; a different key later pauses messaging with them until accepted;
 * - a device counts only if its certificate verifies against that pinned key (this account's own key for its own devices).
 */
export type SenderKey = { kind: "trusted"; signingKey: string } | { kind: "changed" } | { kind: "unknown" };

export interface Recipients {
  devices: RecipientDevice[];
  /** Members whose identity key changed: nothing may be encrypted until each is accepted. */
  changed: string[];
  /**
   * AI agents reading the conversation (server AI_WORKFORCE_2_PLAN.md phase 5), certified like anyone's devices. Never in
   * [devices]: the sender adds one only for messages and only when their person chose to share with it.
   */
  readers: (RecipientDevice & { readerId: string; installId: string; name: string })[];
}

/** This person's choice per reader in a conversation (null: not chosen yet, treated as keep). */
const zReaderChoices = z.object({
  readingEnabled: z.boolean(),
  readers: z.array(z.object({ readerId: z.string(), installId: z.string(), name: z.string(), mode: z.enum(["channel", "direct"]), myChoice: z.enum(["share", "keep"]).nullable() }).passthrough()),
});
export type ReaderChoices = z.infer<typeof zReaderChoices>;

const zUsersKeys = z.object({ users: z.array(zUserKeys) });
const CACHE_MS = 60_000;

export class Directory {
  private users = new Map<string, { keys: UserKeys; at: number }>();
  private conversations = new Map<string, { userIds: string[]; readers: UserKeys[]; at: number }>();
  private choices = new Map<string, { value: ReaderChoices; at: number }>();
  private verified = new Set<string>();

  constructor(
    private readonly api: ApiClient,
    private readonly store: LocalStore,
    private readonly me: { userId: string; deviceId: string; identityKey: string },
    private readonly onIdentityChanged: (pin: PinnedIdentity) => void,
  ) {}

  invalidateUser(userId: string): void {
    this.users.delete(userId);
    for (const [id, c] of this.conversations) if (c.userIds.includes(userId)) this.conversations.delete(id);
  }

  invalidateConversation(conversationId: string): void {
    this.conversations.delete(conversationId);
    this.choices.delete(conversationId);
  }

  /** This person's choice for each agent reading [conversationId] (cached a minute; refreshed when it changes). */
  async readerChoices(conversationId: string, force = false): Promise<ReaderChoices> {
    const cached = this.choices.get(conversationId);
    if (!force && cached && Date.now() - cached.at < CACHE_MS) return cached.value;
    const value = await this.api.json("GET", `/v1/conversations/${encodeURIComponent(conversationId)}/ai/readers`, zReaderChoices).catch(() => ({ readingEnabled: false, readers: [] }));
    this.choices.set(conversationId, { value, at: Date.now() });
    return value;
  }

  setReaderChoices(conversationId: string, value: ReaderChoices): void {
    this.choices.set(conversationId, { value, at: Date.now() });
  }

  /** Every certified device of every member except this browser, refetched when [force] or older than a minute. */
  async recipients(conversationId: string, force = false): Promise<Recipients> {
    const cached = this.conversations.get(conversationId);
    let users: UserKeys[];
    let readerKeys: UserKeys[];
    if (!force && cached && Date.now() - cached.at < CACHE_MS && cached.userIds.every((u) => this.users.has(u))) {
      users = cached.userIds.map((u) => this.users.get(u)!.keys);
      readerKeys = cached.readers;
    } else {
      // This app shows the notice and honours each member's choice, so it asks for readers too (they're kept apart:
      // an agent's identity has a different device in each conversation, so it isn't cached as a person).
      const all = (await this.api.json("GET", `/v1/conversations/${encodeURIComponent(conversationId)}/devices`, zUsersKeys, { headers: { "x-meldiq-ai-reader": "1" } })).users;
      users = all.filter((u) => !u.agent);
      readerKeys = all.filter((u) => u.agent);
      const at = Date.now();
      for (const u of users) this.users.set(u.userId, { keys: u, at });
      this.conversations.set(conversationId, { userIds: users.map((u) => u.userId), readers: readerKeys, at });
    }
    const readers: Recipients["readers"] = [];
    for (const u of readerKeys) {
      const key = await this.trustedKey(u);
      if (key === null || !u.agent) continue; // an agent whose key changed is never shared with
      for (const d of await this.certified(u.devices, key))
        readers.push({ deviceId: d.id, encryptionKey: d.encryptionKey, readerId: u.agent.readerId, installId: u.agent.installId, name: u.agent.name });
    }
    const devices: RecipientDevice[] = [];
    const changed: string[] = [];
    for (const u of users) {
      const key = await this.trustedKey(u);
      if (key === null) {
        changed.push(u.userId);
        continue;
      }
      for (const d of await this.certified(u.devices, key)) if (d.id !== this.me.deviceId) devices.push({ deviceId: d.id, encryptionKey: d.encryptionKey });
    }
    return { devices, changed, readers };
  }

  /**
   * The signing key to verify the device that signed an envelope the server accepted at [serverTs], after the same
   * checks: an active device, or one revoked no earlier than [serverTs] (T1.5, as on the phone). The server accepts
   * nothing from a device once it's revoked, so a later envelope is unknown. Revoked devices are never encrypted to.
   */
  async senderKey(userId: string, deviceId: string, serverTs: number): Promise<SenderKey> {
    for (const refetch of [false, true]) {
      const u = await this.userKeys(userId, refetch);
      if (!u) return { kind: "unknown" };
      const key = await this.trustedKey(u);
      if (key === null) return { kind: "changed" };
      const d = (await this.certified(u.devices, key)).find((x) => x.id === deviceId);
      if (d) return { kind: "trusted", signingKey: d.signingKey };
      const revoked = (await this.certified(u.revokedDevices, key)).find((x) => x.id === deviceId && serverTs <= x.revokedAt);
      if (revoked) return { kind: "trusted", signingKey: revoked.signingKey };
    }
    return { kind: "unknown" };
  }

  /** The person compared safety numbers and accepts [identityKey], the exact key they were shown. */
  async acceptIdentity(userId: string, identityKey: string): Promise<void> {
    const pin = await this.store.pin(userId);
    await this.store.putPin({ userId, identityKey, changedTo: null, verified: pin?.verified ?? false });
    this.invalidateUser(userId);
  }

  private async userKeys(userId: string, refetch: boolean): Promise<UserKeys | null> {
    const cached = this.users.get(userId);
    if (!refetch && cached && Date.now() - cached.at < CACHE_MS) return cached.keys;
    const r = await this.api.json("POST", "/v1/users/devices", zUsersKeys, { body: { userIds: [userId] } });
    const u = r.users.find((x) => x.userId === userId) ?? null;
    if (u) this.users.set(userId, { keys: u, at: Date.now() });
    return u;
  }

  /** Trust on first use. Null while the server presents a key other than the pinned one. */
  private async trustedKey(u: UserKeys): Promise<string | null> {
    if (u.userId === this.me.userId) return u.identityKey === this.me.identityKey ? u.identityKey : null;
    const pin = await this.store.pin(u.userId);
    if (!pin) {
      await this.store.putPin({ userId: u.userId, identityKey: u.identityKey, changedTo: null, verified: false });
      return u.identityKey;
    }
    if (pin.identityKey === u.identityKey) {
      if (pin.changedTo !== null) await this.store.putPin({ ...pin, changedTo: null }); // the server went back to the pinned key
      return u.identityKey;
    }
    if (pin.changedTo !== u.identityKey) {
      const changed = { ...pin, changedTo: u.identityKey };
      await this.store.putPin(changed);
      this.onIdentityChanged(changed);
    }
    return null;
  }

  private async certified<D extends UserKeys["devices"][number]>(devices: readonly D[], identityKey: string): Promise<D[]> {
    const out: D[] = [];
    for (const d of devices) {
      const cacheKey = `${identityKey}|${d.signingKey}|${d.encryptionKey}|${d.certificate}`;
      if (this.verified.has(cacheKey) || (await verify(identityKey, canonical.deviceCert(identityKey, d.signingKey, d.encryptionKey), d.certificate))) {
        this.verified.add(cacheKey);
        out.push(d);
      }
    }
    return out;
  }
}
