import { describe, expect, it } from "vitest";
import type { StoredMessage } from "../src/model/types";
import { threadActivity, THREADS_SHOWN } from "../src/sync/threads";

const msg = (id: string, over: Partial<StoredMessage>): StoredMessage => ({
  id,
  conversationId: "c1",
  senderUserId: "other",
  senderDeviceId: "d",
  outgoing: false,
  kind: "text",
  text: id,
  replyToId: null,
  threadRootId: null,
  mentions: [],
  mentionAll: false,
  attachments: [],
  sentAt: 0,
  serverTs: 0,
  sortTs: 0,
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

describe("Activity › Thread replies (android ThreadActivityRules)", () => {
  const myRoot = msg("r1", { outgoing: true, sortTs: 10 });
  const theirRoot = msg("r2", { sortTs: 20 });
  const quietRoot = msg("r3", { sortTs: 30 });
  const roots = new Map([
    ["r1", myRoot],
    ["r2", theirRoot],
    ["r3", quietRoot],
  ]);
  const replies = [
    msg("a", { threadRootId: "r1", sortTs: 11 }),
    msg("b", { threadRootId: "r1", sortTs: 12 }),
    msg("c", { threadRootId: "r2", sortTs: 21, outgoing: true }),
    msg("d", { threadRootId: "r2", sortTs: 22 }),
    msg("e", { threadRootId: "r3", sortTs: 31 }), // someone else's thread I never joined
  ];

  it("lists threads I started or replied in, with replies from others since I last looked or replied", () => {
    const t = threadActivity(replies, roots, {});
    expect(t.map((x) => [x.rootId, x.replies, x.unseen])).toEqual([
      ["r2", 2, 1],
      ["r1", 2, 2],
    ]);
    expect(t[0]).toMatchObject({ conversationId: "c1", lastReplyAt: 22, lastReplierId: "other", root: theirRoot });
  });

  it("puts unseen threads first and forgets what was seen", () => {
    const t = threadActivity(replies, roots, { r2: 22 });
    expect(t.map((x) => [x.rootId, x.unseen])).toEqual([
      ["r1", 2],
      ["r2", 0],
    ]);
    expect(threadActivity(replies, roots, { r1: 12, r2: 22 }).every((x) => x.unseen === 0)).toBe(true);
  });

  it("ignores deleted replies and keeps the list short", () => {
    expect(threadActivity([msg("x", { threadRootId: "r1", sortTs: 50, deleted: true })], roots, {})).toEqual([]);
    const many = Array.from({ length: 40 }, (_, i) => msg(`m${i}`, { threadRootId: `t${i}`, outgoing: true, sortTs: i }));
    expect(threadActivity(many, new Map(), {})).toHaveLength(THREADS_SHOWN);
  });
});
