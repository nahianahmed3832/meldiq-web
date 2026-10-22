import { describe, expect, it } from "vitest";
import type { Category } from "../src/api/communitySchemas";
import {
  allMuted,
  categoryMenu,
  channelMenu,
  channelRequest,
  channelSections,
  channelTypeOf,
  deleteConfirmed,
  layoutPositions,
  markReadTargets,
  moved,
  moveToCategory,
  muteTargets,
  orderedOverwrites,
  overwritesGated,
  overwriteState,
  overwritesSynced,
  type PanelChannel,
  panelSections,
  railOrdered,
  syncTargets,
  UNCATEGORISED,
  withState,
} from "../src/sync/communityRules";
import { applyOp, countsEveryone, EMPTY_PREFS, levelOf, mutedUntil, type NavPrefs, replay } from "../src/sync/navPrefs";

/** The phone's cases (android CommunityRulesTest, CommunityPanelRulesTest, CommunityMenuRulesTest, CommunityNavigationRulesTest). */
const cat = (id: string, name: string, position: number): Category => ({ id, name, position, channelCount: 0, canManage: false, canCreateChannels: false });
const cats = [cat("talk", "Talk", 1), cat("start", "Start here", 0), cat("empty", "Empty", 2)];
const ref = (id: string, categoryId: string | null, position: number) => ({ id, name: id, categoryId, position });
const ch = (id: string, o: Partial<PanelChannel> = {}): PanelChannel => ({
  id,
  name: id,
  categoryId: "talk",
  position: 0,
  kind: "PUBLIC",
  voice: false,
  format: "text",
  topic: null,
  joined: true,
  unread: 0,
  mentions: 0,
  muted: false,
  liveCall: false,
  canManage: false,
  archived: false,
  ...o,
});

describe("channel tree", () => {
  it("groups channels by category in the community's order, uncategorised first", () => {
    const s = channelSections([ref("general", "talk", 0), ref("random", null, 0), ref("welcome", "start", 1), ref("rules", "start", 0), ref("intros", "talk", 1)], cats);
    expect(s.map((x) => x.key)).toEqual([UNCATEGORISED, "category:start", "category:talk"]);
    expect(s[1].channels.map((c) => c.id)).toEqual(["rules", "welcome"]);
    expect(s[2].channels.map((c) => c.id)).toEqual(["general", "intros"]);
    expect(s[1].title).toBe("Start here");
  });

  it("shows empty categories only for the people arranging them", () => {
    expect(channelSections([ref("general", "talk", 0)], cats).map((x) => x.key)).toEqual(["category:talk"]);
    expect(channelSections([ref("general", "talk", 0)], cats, true).map((x) => x.key)).toEqual(["category:start", "category:talk", "category:empty"]);
  });

  it("keeps a category the list doesn't know yet, titled from the channel", () => {
    const s = channelSections([{ ...ref("x", "new", 0), categoryName: "Fresh" }], []);
    expect(s.map((x) => x.key)).toEqual(["category:new"]);
    expect(s[0].title).toBe("Fresh");
  });

  it("takes channel types from kind, voice and format", () => {
    expect(channelTypeOf("PRIVATE", true, "text")).toBe("voice");
    expect(channelTypeOf("PUBLIC", false, "forum")).toBe("forum");
    expect(channelTypeOf("ANNOUNCEMENT", false, "text")).toBe("announcement");
    expect(channelTypeOf(null, false, null)).toBe("text");
    expect(channelRequest("forum", true)).toEqual({ kind: "PRIVATE", voice: false, format: "forum" });
    // Announcements are never private.
    expect(channelRequest("announcement", true)).toEqual({ kind: "ANNOUNCEMENT", voice: false, format: "text" });
    expect(channelRequest("voice", false)).toEqual({ kind: "PUBLIC", voice: true, format: "text" });
  });
});

describe("community panel", () => {
  const two = [cat("start", "Start here", 0), cat("talk", "Talk", 1)];
  it("follows the community order, uncategorised channels first", () => {
    const s = panelSections([ch("general", { position: 1 }), ch("intro", { position: 0 }), ch("rules", { categoryId: "start" }), ch("loose", { categoryId: null })], two, { collapsed: new Set() });
    expect(s.map((x) => x.key)).toEqual(["category:none", "category:start", "category:talk"]);
    expect(s[2].shown.map((c) => c.id)).toEqual(["intro", "general"]);
  });

  it("a collapsed category keeps channels with something new and the open one", () => {
    const s = panelSections([ch("quiet"), ch("busy", { unread: 2 }), ch("pinged", { mentions: 1 }), ch("open")], two, { collapsed: new Set(["category:talk"]), selectedId: "open" });
    expect(s).toHaveLength(1);
    expect(s[0].collapsed).toBe(true);
    expect(new Set(s[0].shown.map((c) => c.id))).toEqual(new Set(["busy", "pinged", "open"]));
    expect(s[0].channels).toHaveLength(4);
    const calm = panelSections([ch("quiet")], two, { collapsed: new Set(["category:talk"]) });
    expect(calm).toHaveLength(1);
    expect(calm[0].shown).toEqual([]);
  });

  it("hiding muted channels keeps the ones that mention you", () => {
    const s = panelSections([ch("a"), ch("muted", { muted: true }), ch("muted-ping", { muted: true, mentions: 1 })], two, { collapsed: new Set(), hideMuted: true });
    expect(s[0].shown.map((c) => c.id)).toEqual(["a", "muted-ping"]);
  });

  it("unread only drops quiet sections, and starred channels aren't listed twice", () => {
    const list = [ch("a", { unread: 1 }), ch("b"), ch("c", { categoryId: "start" })];
    const s = panelSections(list, two, { collapsed: new Set(), unreadOnly: true });
    expect(s.map((x) => x.key)).toEqual(["category:talk"]);
    expect(s[0].shown.map((c) => c.id)).toEqual(["a"]);
    expect(panelSections(list, two, { collapsed: new Set(), placed: new Set(["a"]) }).flatMap((x) => x.shown.map((c) => c.id))).not.toContain("a");
  });

  it("keeps empty categories only for the people who fill them, and hidden channels while they mention you", () => {
    expect(panelSections([ch("a")], two, { collapsed: new Set() })).toHaveLength(1);
    expect(panelSections([ch("a")], two, { collapsed: new Set(), keepEmpty: true })).toHaveLength(2);
    const hidden = panelSections([ch("a"), ch("h"), ch("hp", { mentions: 1 })], two, { collapsed: new Set(), hidden: new Set(["h", "hp"]) });
    expect(hidden[0].shown.map((c) => c.id)).toEqual(["a", "hp"]);
  });

  it("mark as read and mute act on joined channels only", () => {
    const list = [ch("a", { unread: 1 }), ch("b", { muted: true }), ch("c", { mentions: 1 }), ch("x", { joined: false })];
    expect(markReadTargets(list)).toEqual(["a", "c"]);
    expect(allMuted(list)).toBe(false);
    expect(muteTargets(list, true)).toEqual(["a", "c"]);
    expect(muteTargets(list, false)).toEqual(["b"]);
  });
});

describe("menus", () => {
  it("members get personal items only", () => {
    expect(channelMenu(ch("c", { unread: 2 }), { starred: false, canArrange: false, canMoveUp: true, canMoveDown: true, canDelete: true })).toEqual(["markRead", "favourite", "mute", "copyName"]);
  });

  it("managers can edit, set permissions, arrange, archive and delete", () => {
    expect(channelMenu(ch("c", { canManage: true, muted: true }), { starred: true, canArrange: true, canMoveUp: false, canMoveDown: true, canDelete: true })).toEqual([
      "unfavourite",
      "unmute",
      "copyName",
      "edit",
      "permissions",
      "moveTo",
      "moveDown",
      "archive",
      "delete",
    ]);
    const older = channelMenu(ch("c", { canManage: true, archived: true }), { starred: false, canArrange: false, canMoveUp: false, canMoveDown: false, canDelete: false });
    expect(older).not.toContain("delete");
    expect(older).not.toContain("edit");
    expect(older).toContain("restore");
  });

  it("a channel you haven't joined offers nothing personal; hiding is offered where the server keeps it", () => {
    expect(channelMenu(ch("c", { joined: false }), { starred: false, canArrange: false, canMoveUp: false, canMoveDown: false, canDelete: false })).toEqual(["copyName"]);
    expect(channelMenu(ch("c"), { starred: false, canArrange: false, canMoveUp: false, canMoveDown: false, canDelete: false, canHide: true, hidden: true })).toContain("show");
  });

  it("category menus follow permissions, and the uncategorised group has nothing to manage", () => {
    expect(categoryMenu({ isCategory: true, collapsed: false, hasNews: true, hasJoined: true, allMuted: false, canCreate: false, canManage: false, canMoveUp: true, canMoveDown: true })).toEqual([
      "markRead",
      "collapse",
      "collapseAll",
      "mute",
    ]);
    expect(categoryMenu({ isCategory: true, collapsed: true, hasNews: false, hasJoined: true, allMuted: true, canCreate: true, canManage: true, canMoveUp: true, canMoveDown: false })).toEqual([
      "expand",
      "collapseAll",
      "unmute",
      "newChannel",
      "rename",
      "permissions",
      "moveUp",
      "delete",
    ]);
    expect(categoryMenu({ isCategory: false, collapsed: false, hasNews: false, hasJoined: false, allMuted: false, canCreate: true, canManage: true, canMoveUp: true, canMoveDown: true })).toEqual([
      "collapse",
      "collapseAll",
      "newChannel",
    ]);
  });

  it("deleting needs the channel's exact name, with or without the hash", () => {
    expect(deleteConfirmed("old-news", " #old-news ")).toBe(true);
    expect(deleteConfirmed("old-news", "old-news")).toBe(true);
    expect(deleteConfirmed("old-news", "old")).toBe(false);
    expect(deleteConfirmed("", "")).toBe(false);
  });
});

describe("overwrites and layout", () => {
  const o = { subject: "everyone", kind: "everyone" as const, label: "@everyone", color: null, allow: ["messages.post"], deny: ["channels.view"] };
  it("change one capability at a time", () => {
    expect(overwriteState(o, "messages.post")).toBe("allow");
    expect(overwriteState(o, "channels.view")).toBe("deny");
    expect(overwriteState(o, "messages.attach")).toBe("inherit");
    expect(overwriteState(undefined, "messages.attach")).toBe("inherit");
    expect(withState(o, "messages.attach", "deny")).toEqual({ allow: ["messages.post"], deny: ["channels.view", "messages.attach"] });
    expect(withState(o, "channels.view", "allow")).toEqual({ allow: ["messages.post", "channels.view"], deny: [] });
    expect(withState(o, "messages.post", "inherit")).toEqual({ allow: [], deny: ["channels.view"] });
    expect(overwritesGated([o])).toBe(true);
    expect(overwritesGated([{ ...o, deny: [] }])).toBe(false);
  });

  it("list in the order they apply, and say when a channel follows its category", () => {
    const list = [
      { subject: "user:u1", kind: "member" as const, label: "Zed" },
      { subject: "r2", kind: "role" as const, label: "Mods" },
      { subject: "everyone", kind: "everyone" as const, label: "@everyone" },
      { subject: "r1", kind: "role" as const, label: "Artists" },
    ];
    expect(orderedOverwrites(list).map((x) => x.subject)).toEqual(["everyone", "r1", "r2", "user:u1"]);
    const none = { subject: "everyone", allow: [], deny: [] };
    const own = { subject: "role_a", allow: ["messages.post"], deny: [] };
    expect(overwritesSynced([])).toBe(true);
    expect(overwritesSynced([none])).toBe(true);
    expect(overwritesSynced([none, own])).toBe(false);
    expect(syncTargets([none, own])).toEqual(["role_a"]);
  });

  it("moves keep everything else in place", () => {
    expect(moved(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moved(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"]);
    expect(moved(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"]);
    expect(moved(["a", "b", "c"], "zzz", 1)).toEqual(["a", "b", "c"]);
    expect(layoutPositions("talk", ["x", "y"])).toEqual([
      { id: "x", categoryId: "talk", position: 0 },
      { id: "y", categoryId: "talk", position: 1 },
    ]);
    expect(moveToCategory("c", null, ["a", "c"])).toEqual([
      { id: "a", categoryId: null, position: 0 },
      { id: "c", categoryId: null, position: 1 },
    ]);
  });
});

describe("community notifications and the rail (batches B2, B3)", () => {
  const p = (x: Partial<NavPrefs> = {}): NavPrefs => ({ ...EMPTY_PREFS, ...x });
  it("channels follow the community level unless they have their own", () => {
    const q = applyOp(p({ notify: { c2: "none" } }), { op: "community", level: "mentions" });
    expect(levelOf(q, "c1")).toBe("mentions");
    expect(levelOf(q, "c2")).toBe("none");
    expect(levelOf(p(), "c1")).toBe("all");
  });

  it("keeps an explicit all only while the community is quieter", () => {
    const quiet = applyOp(p(), { op: "community", level: "none" });
    const loud = applyOp(quiet, { op: "notify", conversationId: "c1", level: "all" });
    expect(loud.notify).toEqual({ c1: "all" });
    expect(levelOf(loud, "c1")).toBe("all");
    expect(applyOp(loud, { op: "community", level: "all" }).notify).toEqual({});
    expect(applyOp(p(), { op: "notify", conversationId: "c1", level: "all" }).notify).toEqual({});
  });

  it("reset makes a channel follow the community again; community fields change one at a time", () => {
    const q = replay(p({ notify: { c1: "none" } }), [
      { op: "community", suppressEveryone: true },
      { op: "community", level: "mentions" },
      { op: "notifyReset", conversationId: "c1" },
    ]);
    expect(q.community).toEqual({ level: "mentions", suppressEveryone: true });
    expect(levelOf(q, "c1")).toBe("mentions");
    expect(countsEveryone(q)).toBe(false);
    expect(countsEveryone(p())).toBe(true);
  });

  it("a category's level sits between the channel's and the community's; timed mutes end by themselves", () => {
    const q = replay(p(), [
      { op: "community", level: "mentions" },
      { op: "categoryNotify", categoryId: "cat_a", level: "none" },
      { op: "muteUntil", conversationId: "c9", until: 2_000 },
    ]);
    expect(levelOf(q, "c1", "cat_a")).toBe("none");
    expect(levelOf(q, "c1", "cat_b")).toBe("mentions");
    expect(levelOf(q, "c9", null, 1_000)).toBe("none");
    expect(levelOf(q, "c9", null, 3_000)).toBe("mentions");
    expect(mutedUntil(q, "c9", 1_000)).toBe(2_000);
    // Choosing a level ends a timed mute; "all" stays stored while the category is quieter.
    const r = applyOp(q, { op: "notify", conversationId: "c9", level: "all", categoryId: "cat_a" });
    expect(r.mutedUntil).toEqual({});
    expect(r.notify).toEqual({ c9: "all" });
    expect(applyOp(q, { op: "categoryNotify", categoryId: "cat_a", level: null }).categoryNotify).toEqual({});
  });

  it("hides and shows channels, and keeps the rail in the arranged order with new communities at the end", () => {
    const h = applyOp(applyOp(p(), { op: "hide", conversationId: "c1", hidden: true }), { op: "hide", conversationId: "c1", hidden: true });
    expect(h.hidden).toEqual(["c1"]);
    expect(applyOp(h, { op: "hide", conversationId: "c1", hidden: false }).hidden).toEqual([]);
    const orgs = ["o_a", "o_b", "o_c", "o_new"];
    expect(railOrdered(orgs, ["o_c", "o_gone", "o_a", "o_b"], (x) => x)).toEqual(["o_c", "o_a", "o_b", "o_new"]);
    expect(railOrdered(orgs, undefined, (x) => x)).toEqual(orgs);
    expect(applyOp(p(), { op: "railOrder", orgIds: ["o_b", "o_a", "o_b"] }).railOrder).toEqual(["o_b", "o_a"]);
  });
});
