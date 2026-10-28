import { z } from "zod";
import { ApiError } from "../api/client";
import { type Activity, type Conversation, type Device, type Member, type OrgDetail, zActivity, zConversation, zDevice, zMember, zOrgDetail, zProfile } from "../api/schemas";
import { AccountApi } from "../auth/accountApi";
import { normalizeEmail } from "../auth/rules";
import { forgetPush } from "../application/webPush";
import { LocalStore } from "../store/db";
import type { Engine } from "./engine";

/** Account, people and workspace actions: thin wrappers over existing server routes (server/src/routes). */

const zSearch = z.object({ users: z.array(zMember) });

export async function searchPeople(engine: Engine, q: string): Promise<Member[]> {
  const term = q.trim();
  if (!term) return [];
  return (await engine.api.json("GET", `/v1/users/search?q=${encodeURIComponent(term.slice(0, 40))}`, zSearch)).users;
}

/** Opens (or creates) the direct conversation with [userId] and returns its id. */
/** Someone on another server by their exact address (@name:domain), found through federation (exact match only). */
export async function resolveAddress(engine: Engine, address: string): Promise<Member> {
  const r = await engine.api.json("GET", `/v1/federation/resolve?address=${encodeURIComponent(address.trim())}`, z.object({ user: zMember }));
  return r.user;
}

export async function startDirect(engine: Engine, userId: string): Promise<string> {
  const { conversation } = await engine.api.json("POST", "/v1/conversations/dm", z.object({ conversation: zConversation }), { body: { userId } });
  await engine.ensureConversation(conversation.id);
  return conversation.id;
}

export async function browseChannels(engine: Engine, orgId: string): Promise<Conversation[]> {
  return (await engine.api.json("GET", `/v1/orgs/${encodeURIComponent(orgId)}/channels`, z.object({ channels: z.array(zConversation) }))).channels;
}

export async function joinChannel(engine: Engine, conversationId: string): Promise<void> {
  await engine.api.json("POST", `/v1/conversations/${encodeURIComponent(conversationId)}/join`, z.object({ conversation: zConversation }));
  await engine.refreshAll();
}

export async function orgDetail(engine: Engine, orgId: string): Promise<OrgDetail> {
  return engine.api.json("GET", `/v1/orgs/${encodeURIComponent(orgId)}`, zOrgDetail);
}

export async function orgActivity(engine: Engine, orgId: string): Promise<Activity[]> {
  return (await engine.api.json("GET", `/v1/orgs/${encodeURIComponent(orgId)}/activity`, z.object({ activity: z.array(zActivity) }))).activity;
}

export async function conversationMembers(engine: Engine, conversationId: string): Promise<Member[]> {
  return (await engine.api.json("GET", `/v1/conversations/${encodeURIComponent(conversationId)}/members`, z.object({ members: z.array(zMember) }))).members;
}

/** Your address on the Meldiq network (`@name:server`), when this server federates; null when it doesn't. */
export async function networkAddress(engine: Engine): Promise<string | null> {
  if (!engine.state.get().server?.federation) return null;
  return (await engine.api.json("GET", "/v1/federation/info", z.object({ address: z.string().max(300) }))).address;
}

export async function userProfile(engine: Engine, userId: string) {
  return (await engine.api.json("GET", `/v1/users/${encodeURIComponent(userId)}`, z.object({ user: zProfile }))).user;
}

/** Your animated avatar: a GIF or WebP, or a short video clip the server turns into a 3 s silent loop (API 0.45.0). */
export async function setAvatarMedia(engine: Engine, file: Uint8Array): Promise<void> {
  await engine.api.call("PUT", "/v1/users/me/avatar-media", { raw: file });
}

export async function removeAvatarMedia(engine: Engine): Promise<void> {
  await engine.api.call("DELETE", "/v1/users/me/avatar-media");
}

/** Your profile banner: a JPEG, or an animated GIF or WebP (API 0.45.0). */
export async function setProfileBanner(engine: Engine, file: Uint8Array): Promise<void> {
  await engine.api.call("PUT", "/v1/users/me/profile-banner", { raw: file });
}

export async function removeProfileBanner(engine: Engine): Promise<void> {
  await engine.api.call("DELETE", "/v1/users/me/profile-banner");
}

export interface ProfileStyleChange {
  decoration?: string | null;
  effect?: string | null;
  accent?: string | null;
  /** API 0.46.0: name styles and the community tag worn by your name. */
  nameFont?: string | null;
  nameColors?: string[] | null;
  nameEffect?: string | null;
  tagOrgId?: string | null;
}

export async function setProfileStyle(engine: Engine, change: ProfileStyleChange): Promise<void> {
  await engine.api.call("PUT", "/v1/users/me/profile-style", { body: change });
}

export async function updateProfile(engine: Engine, change: { displayName?: string; statusText?: string | null }): Promise<void> {
  await engine.api.call("PATCH", "/v1/users/me", { body: change });
  await engine.refreshAll();
}

export async function listDevices(engine: Engine): Promise<Device[]> {
  return (await engine.api.json("GET", "/v1/devices", z.object({ devices: z.array(zDevice) }))).devices;
}

export async function revokeDevice(engine: Engine, deviceId: string): Promise<void> {
  await engine.api.call("DELETE", `/v1/devices/${encodeURIComponent(deviceId)}`);
}

export class SignOutUnconfirmed extends Error {}

/** Some of this browser's chats aren't in the account's history yet; signing out now would lose them here. */
export class BackupUnsent extends Error {
  constructor(
    /** This browser was set up before it could back up (2026-10-28) and needs its keys opened once. */
    readonly needsKeys: boolean,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Backs this browser's unsent chats up into the account's encrypted history (2026-10-28, the owner: chats vanished after
 * signing out; they must come back at every sign-in), so they come back when the account signs in again, here or
 * anywhere. Throws [BackupUnsent] when it couldn't: signing out then asks first.
 */
export async function backUpBeforeSignOut(engine: Engine): Promise<void> {
  const backup = engine.state.get().history.backup;
  if (backup.mode === "needs-keys") throw new BackupUnsent(true, "This browser was set up before it could back up its chats.");
  try {
    await engine.flushBackup();
  } catch (e) {
    throw new BackupUnsent(
      false,
      e instanceof ApiError && e.isNetwork ? "You're offline, so this browser's newest chats couldn't be backed up." : "This browser's newest chats couldn't be backed up.",
    );
  }
}

/**
 * Signs this browser out: backs its chats up into the account's history (unless [skipBackup]), removes it from the
 * account (so contacts stop encrypting to it and its queue is deleted), then removes its keys and its local copy from this
 * computer (android "Sign out", T1.9). If the server can't confirm the removal, nothing is removed unless [force].
 */
export async function signOut(engine: Engine, force = false, skipBackup = false): Promise<void> {
  if (!skipBackup) await backUpBeforeSignOut(engine);
  engine.setSigningOut(true);
  try {
    await revokeDevice(engine, engine.device.deviceId);
  } catch (e) {
    const gone = e instanceof ApiError && (e.status === 401 || e.status === 404);
    if (!gone && !force) {
      engine.setSigningOut(false);
      throw new SignOutUnconfirmed(e instanceof ApiError ? e.message : "Couldn't reach the server");
    }
  }
  engine.stop();
  engine.session.forget();
  await LocalStore.erase(engine.store);
  // Then this browser stops receiving background notifications (the server removed its token with the device).
  forgetPush();
}

/**
 * Deletes the account on the server (server docs/ACCOUNT_DELETION.md), then this browser's copy of it: keys, messages
 * and files. The server has already ended every session and removed every device, so there is nothing to sign out.
 */
export async function deleteAccount(engine: Engine, password: string, typedEmail: string): Promise<void> {
  await new AccountApi(engine.api).deleteAccount(password, normalizeEmail(typedEmail));
  engine.setSigningOut(true);
  engine.stop();
  engine.session.forget();
  await LocalStore.erase(engine.store);
  // Then this browser stops receiving background notifications (the server removed its token with the device).
  forgetPush();
}
