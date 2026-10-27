import { describe, expect, it } from "vitest";
import type { Conversation } from "../src/api/schemas";
import { appHref, parseRoute, routeHref } from "../src/application/router";
import { initialState, type AppState, upsertLoaded, withMessages } from "../src/state/store";
import { bytes, conversationTitle, dayLabel, relative, sameDay, shortWhen } from "../src/ui/format";
import { channelGroups, inWorkspace, mentionConversations, mentionCount, orgUnread, people, unreadPeopleCount } from "../src/ui/selectors";
import { textMessage } from "../src/sync/rules";

const conv = (over: Partial<Conversation>): Conversation => ({
  id: "c",
  type: "CHANNEL",
  orgId: "o1",
  scope: "ORG",
  scopeId: "o1",
  scopeName: "Acme",
  kind: "PUBLIC",
  name: "general",
  topic: null,
  archived: false,
  createdAt: 1,
  updatedAt: 1,
  memberCount: 3,
  joined: true,
  myRole: "MEMBER",
  canPost: true,
  canManageAccess: false,
  canManage: false,
  canMentionAll: false,
  activeCall: null,
  voice: false,
  categoryId: null,
  categoryName: null,
  position: 0,
  format: "text",
  forumTags: [],
  guidelines: null,
  photoRev: null,
  timedOutUntil: null,
  slowmodeSec: 0,
  slowmodeExempt: false,
  nextPostAt: null,
  request: null,
  ...over,
});

const local = (id: string, unread = 0, mentions = 0, lastActivityAt = 0) => ({
  id,
  unread,
  mentions,
  lastMessageId: null,
  lastPreview: null,
  lastSenderName: null,
  lastActivityAt,
  readUpTo: 0,
  draft: "",
});

describe("routes", () => {
  it("round-trip every route, and fall back safely on anything else", () => {
    for (const r of [
      { section: "home" as const },
      { section: "dms" as const, conversationId: "c_abc" },
      { section: "activity" as const, conversationId: "c_abc", panel: "details" as const },
      { section: "home" as const, conversationId: "c_abc", panel: "thread" as const, threadRoot: "m-1" },
      { section: "settings" as const, settingsPage: "devices" as const },
    ]) {
      expect(routeHref(r).startsWith("/")).toBe(true);
      const parsed = parseRoute(routeHref(r));
      expect(parsed.section).toBe(r.section);
      if ("conversationId" in r) expect(parsed.conversationId).toBe(r.conversationId);
      if ("panel" in r) expect(parsed.panel).toBe(r.panel);
    }
    expect(parseRoute("#/nowhere/c/<script>")).toMatchObject({ section: "home", conversationId: null });
    expect(parseRoute("#/settings/nope").settingsPage).toBe("profile");
    expect(parseRoute("").section).toBe("home");
    expect(parseRoute("/nowhere/c/<script>")).toMatchObject({ section: "home", conversationId: null });
    expect(parseRoute("/dms/c/%E0%A4%A")).toMatchObject({ section: "dms", conversationId: null });
  });

  it("old hash links and this app's own paths open in the app; nothing else does", () => {
    const origin = "https://web.meldiq.app";
    expect(appHref("/dms/c/c_abc/details", origin)).toBe("/dms/c/c_abc/details");
    expect(appHref("https://web.meldiq.app/#/home/c/c_abc", origin)).toBe("/home/c/c_abc");
    expect(appHref("#/settings/devices", origin)).toBe("/settings/devices");
    expect(appHref("/settings/nope", origin)).toBe("/settings/profile");
    for (const other of ["https://evil.example/dms", "/invite/abc", "/meldiq-og.png", "/v1/queue", "javascript:alert(1)", "//evil.example/home"]) expect(appHref(other, origin)).toBeNull();
    // A malformed id is dropped: the section opens, never the raw text.
    expect(appHref("/dms/c/<script>", origin)).toBe("/dms");
  });
});

describe("formatting", () => {
  const now = new Date(2026, 9, 18, 15, 0).getTime();
  it("days and times read naturally", () => {
    expect(dayLabel(now, now)).toBe("Today");
    expect(dayLabel(now - 86_400_000, now)).toBe("Yesterday");
    expect(sameDay(now, now - 3600_000)).toBe(true);
    expect(shortWhen(0)).toBe("");
    expect(relative(now - 10_000, now)).toBe("just now");
    expect(relative(now - 5 * 60_000, now)).toBe("5 min ago");
    expect(bytes(512)).toBe("512 B");
    expect(bytes(2048)).toBe("2.0 KB");
    expect(bytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(bytes(1024 ** 3)).toBe("1.0 GB");
  });

  it("names conversations: channels by name, DMs by the other person", () => {
    const dm = conv({
      id: "d",
      type: "DM",
      orgId: null,
      name: null,
      members: [
        {
          id: "me",
          username: "me",
          displayName: "Me",
          avatarColor: 0,
          statusText: null,
          statusEmoji: null,
          notificationsPaused: null,
          photoRev: null,
          homeServer: null,
          role: null,
          orgRole: null,
          online: null,
          presence: null,
          pronouns: null,
          avatarMedia: null,
          profileStyle: null,
          tag: null,
        },
        {
          id: "u2",
          username: "sam",
          displayName: "Sam",
          avatarColor: 1,
          statusText: null,
          statusEmoji: null,
          notificationsPaused: null,
          photoRev: null,
          homeServer: null,
          role: null,
          orgRole: null,
          online: true,
          presence: null,
          pronouns: null,
          avatarMedia: null,
          profileStyle: null,
          tag: null,
        },
      ],
    });
    expect(conversationTitle(dm, "me", {})).toBe("Sam");
    expect(conversationTitle(dm, "me", { u2: { id: "u2", username: "sam", displayName: "Samuel", avatarColor: 1, statusText: null, online: true } })).toBe("Samuel");
    expect(conversationTitle(conv({}), "me", {})).toBe("general");
    expect(conversationTitle(conv({ type: "GROUP", name: null }), "me", {})).toBe("Group");
  });
});

describe("sidebar selections", () => {
  const state: AppState = {
    ...initialState,
    conversations: {
      g: conv({ id: "g" }),
      t: conv({ id: "t", scope: "TEAM", scopeId: "t1", scopeName: "Design team", name: "pixels" }),
      x: conv({ id: "x", orgId: "o2", name: "other-org" }),
      d: conv({ id: "d", type: "DM", orgId: null, name: null }),
      p: conv({ id: "p", type: "GROUP", orgId: null, name: "Pals" }),
    },
    local: { g: local("g", 2, 0, 5), t: local("t", 0, 0, 3), x: local("x", 4, 1, 9), d: local("d", 1, 1, 7), p: local("p", 0, 0, 8) },
  };

  it("lists a voice room once, in its own section, not again among the channels", () => {
    const withRoom: AppState = { ...state, conversations: { ...state.conversations, v: conv({ id: "v", name: "lounge", voice: true }) } };
    expect(channelGroups(withRoom, "o1").flatMap((g) => g.channels.map((c) => c.id))).toEqual(["g", "t"]);
  });

  it("a workspace shows its own channels, grouped by scope, plus every DM and group", () => {
    expect(channelGroups(state, "o1").map((g) => [g.title, g.channels.map((c) => c.id)])).toEqual([
      ["Channels", ["g"]],
      ["Design team", ["t"]],
    ]);
    expect(inWorkspace(state.conversations.d, "o1")).toBe(true);
    expect(inWorkspace(state.conversations.x, "o1")).toBe(false);
    expect(people(state).map((c) => c.id)).toEqual(["p", "d"]);
  });

  it("counts unread people, mentions and per-workspace unread channels", () => {
    expect(unreadPeopleCount(state)).toBe(1);
    expect(mentionCount(state)).toBe(2);
    expect(mentionConversations(state, "o1").map((c) => c.id)).toEqual(["d"]);
    expect(orgUnread(state, "o1")).toBe(1);
    expect(orgUnread(state, "o2")).toBe(1);
  });

  it("loaded messages stay ordered by server time, and updates replace in place", () => {
    const item = { id: 1, kind: "envelope" as const, conversationId: "g", messageId: "m-a", senderUserId: "u", senderDeviceId: "d", createdAt: 1, expiresAt: 2, payload: {} };
    const a = textMessage({ type: "text", text: "a" }, item, false, 20, { ids: [], all: false });
    const b = textMessage({ type: "text", text: "b" }, { ...item, messageId: "m-b" }, false, 10, { ids: [], all: false });
    let s = withMessages(state, "g", [a, b], false);
    expect(s.messages.g.items.map((m) => m.id)).toEqual(["m-b", "m-a"]);
    s = upsertLoaded(s, { ...a, text: "a2" });
    expect(s.messages.g.items.map((m) => m.text)).toEqual(["b", "a2"]);
    expect(upsertLoaded(s, { ...a, conversationId: "not-loaded" })).toBe(s);
  });
});

describe("Get started (android StartRules)", () => {
  it("shows until hidden or every required step is done; optional steps never keep it up", async () => {
    const { startProgress, startVisible } = await import("../src/ui/views/startRules");
    const steps = [
      { key: "profile", label: "Add your name and photo", done: true },
      { key: "workspace", label: "Create or join a workspace", done: false },
      { key: "apps", label: "Connect the tools you use", done: false, optional: true },
    ];
    expect(startVisible(false, steps)).toBe(true);
    expect(startVisible(true, steps)).toBe(false);
    expect(
      startVisible(
        false,
        steps.map((s) => (s.key === "workspace" ? { ...s, done: true } : s)),
      ),
    ).toBe(false);
    expect(startProgress(steps)).toEqual({ done: 1, total: 3 });
  });
});
