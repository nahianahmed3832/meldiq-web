import "fake-indexeddb/auto";
import nodeCrypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { ApiError, type ApiClient } from "../src/api/client";
import { fromB64, utf8 } from "../src/crypto/bytes";
import { canWriteHistory, deriveHistoryKeys, type HistoryKeys, historyTag, sealHistoryItem } from "../src/crypto/history";
import type { StoredMessage } from "../src/model/types";
import { decodeHistoryRecord, encodeHistoryRecord, historyUploadable } from "../src/protocol/history";
import type { HistoryBackupState } from "../src/state/store";
import { LocalStore } from "../src/store/db";
import { HistoryUploader } from "../src/sync/historyUpload";
import { nodeHistory } from "./support/reference";

/**
 * The owner, 2026-10-28: after signing a browser out, its chats were gone; they must come back at every sign-in. The
 * browser now backs up what it holds into the account's encrypted history, in the phone's own format.
 */
const seed = nodeCrypto.randomBytes(32);

const message = (id: string, over: Partial<StoredMessage> = {}): StoredMessage => ({
  id,
  conversationId: "c-1",
  senderUserId: "u-bob",
  senderDeviceId: "d-bob",
  outgoing: false,
  kind: "text",
  text: `text of ${id}`,
  replyToId: null,
  threadRootId: null,
  mentions: [],
  mentionAll: false,
  attachments: [],
  sentAt: 1_000,
  serverTs: 1_001,
  sortTs: 1_001,
  status: "RECEIVED",
  errorText: null,
  editedAt: null,
  deleted: false,
  pinned: false,
  reactions: {},
  readBy: [],
  deliveredTo: [],
  call: null,
  rich: null,
  forwarded: false,
  ...over,
});

describe("history items written by the browser", () => {
  it("are read by the phone's algorithm, bound to their tag", async () => {
    const node = nodeHistory(seed, "u_alice");
    const keys = await deriveHistoryKeys(seed, "u_alice");
    const tag = await historyTag(keys, "m", "m-1");
    const sealed = await sealHistoryItem(keys, tag, utf8('{"v":1}'));
    expect(node.open(tag, sealed)).toBe('{"v":1}');
    expect(() => node.open(node.tag("m", "m-2"), sealed)).toThrow();
    // A fresh nonce every time.
    expect(Buffer.from(await sealHistoryItem(keys, tag, utf8('{"v":1}'))).equals(Buffer.from(sealed))).toBe(false);
  });

  it("keep everything a message shows, in the phone's row format", () => {
    const m = message("m-1", {
      outgoing: true,
      senderUserId: "u_alice",
      replyToId: "m-0",
      mentions: ["u-bob"],
      mentionAll: true,
      attachments: [{ id: "a-1", name: "photo.jpg", mime: "image/jpeg", size: 10, key: "k", nonce: "n", sha256: "h" }],
      editedAt: 2_000,
      pinned: true,
      reactions: { "👍": ["u-bob"] },
      readBy: ["u-bob"],
      deliveredTo: ["u-bob"],
      rich: { location: { lat: 1, lon: 2 } },
      forwarded: true,
    });
    const json = encodeHistoryRecord(m);
    const row = (JSON.parse(json) as { message: Record<string, unknown> }).message;
    // kotlinx writes no nulls (explicitNulls = false); lists and maps are JSON strings inside the row.
    expect(Object.values(row).some((v) => v === null)).toBe(false);
    expect(row.mentionsJson).toBe('["u-bob","@everyone"]');
    expect(row.errorText).toBeUndefined();
    expect(decodeHistoryRecord(json)?.message).toEqual(m);
  });

  it("are written for settled messages only", () => {
    expect(historyUploadable(message("m"))).toBe(true);
    for (const status of ["SENDING", "FAILED", "HELD"] as const) expect(historyUploadable(message("m", { status }))).toBe(false);
    expect(historyUploadable(message("m", { kind: "undecryptable" }))).toBe(false);
  });

  it("need keys derived since the browser could write: older ones only read", async () => {
    expect(canWriteHistory(await deriveHistoryKeys(seed, "u_alice"))).toBe(true);
    const base = await crypto.subtle.importKey("raw", seed, "HKDF", false, ["deriveKey"]);
    const readOnly = await crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: utf8("orbit-history-v1"), info: utf8("enc|u_alice") }, base, { name: "AES-GCM", length: 256 }, false, [
      "decrypt",
    ]);
    expect(canWriteHistory({ userId: "u_alice", enc: readOnly, tag: (await deriveHistoryKeys(seed, "u_alice")).tag })).toBe(false);
  });
});

interface Put {
  items: { tag: string; conv: string; ts: number; body: string }[];
}

/** The server's history routes, as far as the uploader uses them. */
function fakeServer(opts: { fail?: () => ApiError | null } = {}) {
  const puts: Put[] = [];
  const kept: string[] = [];
  let seq = 0;
  const api = {
    json: async (method: string, path: string, _schema: unknown, o: { body?: unknown } = {}) => {
      const failure = opts.fail?.();
      if (failure) throw failure;
      if (method === "PUT" && path === "/v1/history/items") {
        const body = o.body as Put;
        puts.push(body);
        seq += body.items.length;
        return { seq, items: seq, bytes: 0 };
      }
      if (method === "POST" && path.startsWith("/v1/attachments/")) {
        kept.push(decodeURIComponent(path.split("/")[3]));
        return { kept: true, expiresAt: 0 };
      }
      throw new Error(`unexpected ${method} ${path}`);
    },
  } as unknown as ApiClient;
  return { api, puts, kept };
}

async function setUp(name: string, server = fakeServer()) {
  const store = await LocalStore.open(`history-backup-${name}-${Math.random()}`);
  const keys: HistoryKeys = await deriveHistoryKeys(seed, "u_alice");
  const states: HistoryBackupState[] = [];
  const uploader = new HistoryUploader({ api: server.api, store, keys, keepsFiles: () => true, onState: (s) => states.push(s) });
  return { store, keys, uploader, states, ...server };
}

async function sentIds(puts: Put[]): Promise<string[]> {
  const node = nodeHistory(seed, "u_alice");
  return puts.flatMap((p) => p.items.map((i) => (JSON.parse(node.open(i.tag, fromB64(i.body))) as { message: { id: string } }).message.id));
}

describe("the browser's backup", () => {
  it("sends what this browser already held, then every message written here", async () => {
    const t = await setUp("backfill");
    await t.store.putMessage(message("before"));
    await t.uploader.start();
    await t.uploader.flush();
    expect(await sentIds(t.puts)).toEqual(["before"]);

    await t.store.putMessage(message("after"));
    await t.store.insertMessageIfAbsent(message("inserted"));
    await t.uploader.flush();
    expect(await sentIds(t.puts)).toEqual(["before", "after", "inserted"]);
    expect(t.states.at(-1)).toMatchObject({ mode: "on", pending: 0, error: null });
    // Grouped by the chat's own tag, ordered by the message time.
    expect(t.puts[1].items[0]).toMatchObject({ conv: await historyTag(t.keys, "c", "c-1"), ts: 1_001 });
    t.uploader.stop();
  });

  it("doesn't send messages restored from the history, nor unsettled ones until they settle", async () => {
    const t = await setUp("skip");
    await t.uploader.start();
    await t.store.putMessages([message("restored")], { fromHistory: true });
    await t.store.putMessage(message("sending", { status: "SENDING", outgoing: true }));
    await t.uploader.flush();
    expect(await sentIds(t.puts)).toEqual([]);
    await t.store.putMessage(message("sending", { status: "SENT", outgoing: true }));
    await t.uploader.flush();
    expect(await sentIds(t.puts)).toEqual(["sending"]);
    t.uploader.stop();
  });

  it("doesn't send a message again for a read receipt alone, but does for a reaction", async () => {
    const t = await setUp("receipts");
    await t.uploader.start();
    await t.store.putMessage(message("m-1"));
    await t.uploader.flush();
    await t.store.putMessage(message("m-1", { readBy: ["u-carol"] }));
    await t.uploader.flush();
    expect(await sentIds(t.puts)).toEqual(["m-1"]);
    await t.store.putMessage(message("m-1", { readBy: ["u-carol"], reactions: { "🎉": ["u-carol"] } }));
    await t.uploader.flush();
    expect(await sentIds(t.puts)).toEqual(["m-1", "m-1"]);
    t.uploader.stop();
  });

  it("asks the server to keep a recent message's files", async () => {
    const t = await setUp("keep");
    await t.uploader.start();
    const now = Date.now();
    await t.store.putMessage(message("photo", { sortTs: now, attachments: [{ id: "a-1", name: "p.jpg", mime: "image/jpeg", size: 1, key: "k", nonce: "n", sha256: "h" }] }));
    await t.store.putMessage(message("old", { sortTs: now - 30 * 86_400_000, attachments: [{ id: "a-old", name: "p.jpg", mime: "image/jpeg", size: 1, key: "k", nonce: "n", sha256: "h" }] }));
    await t.uploader.flush();
    expect(t.kept).toEqual(["a-1"]);
    t.uploader.stop();
  });

  it("keeps what it couldn't send, and says why, so signing out can ask first", async () => {
    let offline = true;
    const t = await setUp("offline", fakeServer({ fail: () => (offline ? new ApiError(0, "network", "offline") : null) }));
    await t.uploader.start();
    await t.store.putMessage(message("m-1"));
    await expect(t.uploader.flush()).rejects.toBeInstanceOf(ApiError);
    expect(t.states.at(-1)).toMatchObject({ pending: 1, error: "Waiting for a connection" });
    offline = false;
    await t.uploader.flush();
    expect(await sentIds(t.puts)).toEqual(["m-1"]);
    expect(t.states.at(-1)).toMatchObject({ pending: 0, error: null });
    t.uploader.stop();
  });

  it("carries on after a reload with what was still queued", async () => {
    const server = fakeServer({ fail: () => new ApiError(0, "network", "offline") });
    const t = await setUp("reload", server);
    await t.uploader.start();
    await t.store.putMessage(message("m-1"));
    await t.uploader.flush().catch(() => undefined);
    t.uploader.stop();
    const online = fakeServer();
    const again = new HistoryUploader({ api: online.api, store: t.store, keys: t.keys, keepsFiles: () => false, onState: () => undefined });
    await again.start();
    await again.flush();
    expect(await sentIds(online.puts)).toEqual(["m-1"]);
    again.stop();
  });
});
