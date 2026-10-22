import { describe, expect, it } from "vitest";
import { type Conversation, type QueueItem, zConversation } from "../src/api/schemas";
import { applyOp, EMPTY_PREFS, type NavPrefs } from "../src/sync/navPrefs";
import { type WakeInput, wakeNotices } from "../src/sw/wakeRules";

const ME = "u_me";
const NOW = 1_000_000;

function conv(id: string, extra: Record<string, unknown> = {}): Conversation {
  return zConversation.parse({
    id,
    type: "DM",
    archived: false,
    createdAt: 1,
    updatedAt: 1,
    memberCount: 2,
    joined: true,
    canPost: true,
    canManage: false,
    members: [
      { id: ME, username: "me", displayName: "Me" },
      { id: "u_bob", username: "bob", displayName: "Bob Chen" },
    ],
    ...extra,
  });
}

let nextId = 1;
function item(conversationId: string, extra: Partial<QueueItem> & { cls?: "message" | "control"; mentionAll?: boolean } = {}): QueueItem {
  const { cls = "message", mentionAll, ...rest } = extra;
  return {
    id: nextId++,
    kind: "envelope",
    conversationId,
    messageId: `m${nextId}`,
    senderUserId: "u_bob",
    senderDeviceId: "d_bob",
    createdAt: NOW - 1000,
    expiresAt: NOW + 1e6,
    payload: { cls, ...(mentionAll ? { mentionAll } : {}) },
    ...rest,
  };
}

function input(over: Partial<WakeInput> = {}): WakeInput {
  const dm = conv("c_dm");
  const channel = conv("c_ch", { type: "CHANNEL", name: "general", orgId: "o_1", members: undefined, memberCount: 30 });
  return {
    me: ME,
    now: NOW,
    items: [],
    conversations: { [dm.id]: dm, [channel.id]: channel },
    nav: {},
    prefs: { notifications: true, groupNotifications: true, notificationText: true },
    pausedUntil: null,
    ...over,
  };
}

describe("what a background wake-up shows (service worker, no Meldiq tab open)", () => {
  it("one notification per conversation with new messages from others, titled like the app's own", () => {
    const notices = wakeNotices(input({ items: [item("c_dm"), item("c_dm"), item("c_ch"), item("c_dm", { senderUserId: ME })] }));
    expect(notices).toEqual([
      { tag: "c_dm", title: "Bob Chen", body: "2 new messages", url: "/dms/c/c_dm", call: false },
      { tag: "c_ch", title: "#general", body: "New message", url: "/home/c/c_ch", call: false },
    ]);
  });

  it("never wakes anyone for reactions, edits, receipts or their own messages", () => {
    expect(wakeNotices(input({ items: [item("c_dm", { cls: "control" }), { ...item("c_dm"), kind: "receipt" }, item("c_dm", { senderUserId: ME })] }))).toEqual([]);
  });

  it("follows the synced notification levels: muted, timed mute, mentions only, and Ignore @everyone", () => {
    const muted: NavPrefs = applyOp(EMPTY_PREFS, { op: "notify", conversationId: "c_dm", level: "none" });
    expect(wakeNotices(input({ items: [item("c_dm")], nav: { personal: muted } }))).toEqual([]);
    const timed = applyOp(EMPTY_PREFS, { op: "muteUntil", conversationId: "c_ch", until: NOW + 60_000 });
    expect(wakeNotices(input({ items: [item("c_ch")], nav: { o_1: timed } }))).toEqual([]);
    const mentionsOnly = applyOp(EMPTY_PREFS, { op: "notify", conversationId: "c_ch", level: "mentions" });
    expect(wakeNotices(input({ items: [item("c_ch")], nav: { o_1: mentionsOnly } }))).toEqual([]);
    expect(wakeNotices(input({ items: [item("c_ch", { mentionAll: true })], nav: { o_1: mentionsOnly } }))).toHaveLength(1);
    const ignoreEveryone = applyOp(mentionsOnly, { op: "community", suppressEveryone: true });
    expect(wakeNotices(input({ items: [item("c_ch", { mentionAll: true })], nav: { o_1: ignoreEveryone } }))).toEqual([]);
  });

  it("stays quiet when notifications are off, paused, or for message requests; group notifications off keeps DMs", () => {
    expect(wakeNotices(input({ items: [item("c_dm")], prefs: { notifications: false, groupNotifications: true, notificationText: true } }))).toEqual([]);
    expect(wakeNotices(input({ items: [item("c_dm")], pausedUntil: NOW + 1000 }))).toEqual([]);
    const request = conv("c_req", { request: { state: "pending", incoming: true } });
    expect(wakeNotices(input({ items: [item("c_req")], conversations: { c_req: request } }))).toEqual([]);
    const quietGroups = wakeNotices(input({ items: [item("c_dm"), item("c_ch")], prefs: { notifications: true, groupNotifications: false, notificationText: true } }));
    expect(quietGroups.map((n) => n.tag)).toEqual(["c_dm"]);
  });

  it("hides who and how many when message text is hidden in notifications", () => {
    expect(wakeNotices(input({ items: [item("c_dm"), item("c_dm")], prefs: { notifications: true, groupNotifications: true, notificationText: false } }))).toEqual([
      { tag: "c_dm", title: "Meldiq", body: "New message", url: "/dms/c/c_dm", call: false },
    ]);
  });

  it("shows an incoming call ringing from someone else, not a call this person started elsewhere", () => {
    const ringing = conv("c_dm", { activeCall: { id: "k1", video: true, state: "RINGING", startedAt: NOW - 5000 } });
    const invite = item("c_dm", { cls: "control", createdAt: NOW - 4000 });
    expect(wakeNotices(input({ items: [invite], conversations: { c_dm: ringing } }))).toEqual([{ tag: "call-c_dm", title: "Bob Chen", body: "Incoming video call", url: "/dms/c/c_dm", call: true }]);
    // Started from this person's own phone: their own invite reaches this browser, and nothing rings here.
    expect(wakeNotices(input({ items: [{ ...invite, senderUserId: ME }], conversations: { c_dm: ringing } }))).toEqual([]);
    // Answered, ended or long past: no call notification.
    const answered = conv("c_dm", { activeCall: { id: "k1", video: false, state: "ACTIVE", startedAt: NOW - 5000 } });
    expect(wakeNotices(input({ items: [invite], conversations: { c_dm: answered } }))).toEqual([]);
    const stale = conv("c_dm", { activeCall: { id: "k1", video: false, state: "RINGING", startedAt: NOW - 10 * 60_000 } });
    expect(wakeNotices(input({ items: [{ ...invite, createdAt: NOW - 10 * 60_000 }], conversations: { c_dm: stale } }))).toEqual([]);
  });

  it("skips conversations this browser doesn't know (left, or not loaded) instead of guessing", () => {
    expect(wakeNotices(input({ items: [item("c_unknown")] }))).toEqual([]);
  });
});

describe("the page a notification opens", () => {
  it("is a path of this app, also from a notification shown before routes were paths; never another site", async () => {
    const { notificationPath } = await import("../src/sw/messages");
    const origin = "https://web.meldiq.app";
    const at = (u: string) => notificationPath(new URL(u, origin), origin);
    expect(at("/dms/c/c_dm")).toBe("/dms/c/c_dm");
    expect(at("/#/home/c/c_ch")).toBe("/home/c/c_ch");
    expect(at("/settings/notifications")).toBe("/settings/notifications");
    for (const bad of ["https://evil.example/dms/c/x", "/", "/invite/abc", "/v1/queue", "/dms/c/a/b/c/d/e"]) expect(at(bad)).toBeNull();
    // Markup arrives only URL-encoded, inside the app's own section; the page then drops the id it doesn't accept.
    expect(at("/dms/c/<x>")).toBe("/dms/c/%3Cx%3E");
  });
});
