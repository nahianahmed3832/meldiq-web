import { describe, expect, it } from "vitest";
import type { StoredMessage } from "../src/model/types";
import { importItemsOf, payloadOfStored } from "../src/sync/legacyImport";

const base: StoredMessage = {
  id: "msg_00000001",
  conversationId: "c_1",
  senderUserId: "u_bob",
  senderDeviceId: "d_bob",
  outgoing: false,
  kind: "text",
  text: "hello @alice",
  replyToId: "msg_00000000",
  threadRootId: null,
  mentions: ["u_alice"],
  mentionAll: false,
  attachments: [],
  sentAt: 1000,
  serverTs: 1005,
  sortTs: 1005,
  status: "RECEIVED",
  errorText: null,
  editedAt: 1100,
  deleted: false,
  pinned: true,
  reactions: { "👍": ["u_alice", "u_carol"] },
  readBy: [],
  deliveredTo: [],
  call: null,
  rich: { poll: { question: "Lunch?", options: [{ id: "a", text: "Yes" }], multiple: false } as never, votes: { u_alice: ["a"] }, pollClosed: true },
  forwarded: false,
};

/** The one-time upload of a browser's earlier history to the server (API 0.57.0, sync/legacyImport.ts). */
describe("uploading a browser's earlier history", () => {
  it("turns a kept message back into the payload it was sent as, with its final text", () => {
    expect(payloadOfStored(base)).toMatchObject({ type: "text", text: "hello @alice", replyTo: "msg_00000000", mentions: ["u_alice"], poll: { question: "Lunch?" } });
  });

  it("uploads the message, then its reactions, votes, closing and pin as the changes that made them", () => {
    const items = importItemsOf(base);
    expect(items[0]).toMatchObject({ id: base.id, cls: "message", senderUserId: "u_bob", serverTs: 1005 });
    const changes = items.slice(1).map((i) => [i.senderUserId, i.payload.type, i.payload.target]);
    expect(changes).toEqual([
      ["u_alice", "reaction", base.id],
      ["u_carol", "reaction", base.id],
      ["u_alice", "vote", base.id],
      ["u_bob", "poll_close", base.id],
      ["u_bob", "pin", base.id],
    ]);
    // Every id is one the server accepts, and unique.
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    for (const i of items) expect(i.id).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });

  it("uploads nothing for deleted messages and call lines", () => {
    expect(importItemsOf({ ...base, deleted: true })).toEqual([]);
    expect(importItemsOf({ ...base, kind: "call" })).toEqual([]);
  });
});
