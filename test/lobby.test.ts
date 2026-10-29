import { describe, expect, it } from "vitest";
import { LOBBY_SECTION_KEYS, type LobbySettings, type LobbyView, zLobbySettingsView, zLobbyView } from "../src/api/lobbySchemas";
import { zOrg } from "../src/api/schemas";
import { zOrgPermissions } from "../src/api/workspaceSchemas";
import { parseRoute, routeHref } from "../src/application/router";
import { landsOnLobby, LOBBY_FEATURE, lobbyFeedUrl, offersLobby } from "../src/sync/lobby";
import {
  cardState,
  changeCount,
  changedFields,
  draftProblem,
  lobbyIsBare,
  moveItem,
  moveSection,
  pageColumns,
  pickRolesAnswer,
  setSection,
  setWhoRunsIt,
  settingsBody,
  toggleBoard,
  togglePick,
  withDraft,
} from "../src/sync/lobbyDraft";
import { parseInline, parseMarkdown } from "../src/ui/lobby/markdownParse";
import { communityPageTitle, visibleCommunityRail } from "../src/ui/workspace/communityRail";

/** Community parity B (docs/MELDIQ_COMMUNITY_PARITY.md › Lobby): the lobby's answers, its draft and its Markdown. */

const SIDE = new Set(["leaderboard", "pick_roles", "rules", "who_runs_it", "links"]);
const settingsJson = {
  enabled: true,
  tagline: null,
  buttons: [],
  about: null,
  mainChannelIds: [],
  faq: [],
  showWhoRunsIt: true,
  look: { layout: "classic", accent: "auto", background: "glow", cards: "filled", font: "default", bannerHeight: "normal", title: "left" },
  sections: LOBBY_SECTION_KEYS.map((key) => ({ key, shown: true, column: SIDE.has(key) ? "side" : "main" })),
  leaderboards: ["messages_week"],
};
const person = (id: string) => ({ id, username: id, displayName: id.toUpperCase(), avatarColor: 2, photoRev: null });
const viewJson = {
  community: { id: "o1", name: "Night Owls", photoRev: null, bannerRev: 3, accent: "#8b5cf6", memberCount: 12, onlineCount: 4 },
  settings: settingsJson,
  rev: 0,
  canEdit: true,
  seen: false,
  seenAt: null,
  mainChannels: [{ id: "c1", name: "general", kind: "PUBLIC", voice: false, format: "text", lastActiveAt: 1_700_000_000_000 }],
  mainChannelsPicked: false,
  whoRunsIt: [{ user: person("ana"), badge: "owner" }],
  liveNow: [],
  rules: null,
  links: [],
  pickRoles: { prompts: [], answered: [] },
  leaderboards: [{ board: "messages_week", entries: [] }],
  giveaways: [],
  feed: [],
};
const base = (): LobbySettings => zLobbyView.parse(viewJson).settings;
const view = (): LobbyView => zLobbyView.parse(viewJson);

describe("lobby answers", () => {
  it("reads the server's lobby view", () => {
    const v = view();
    expect(v.community.onlineCount).toBe(4);
    expect(v.settings.sections).toHaveLength(11);
    expect(v.whoRunsIt[0].badge).toBe("owner");
  });

  it("keeps the page when a newer server sends look values or cards this version doesn't know", () => {
    const v = zLobbyView.parse({
      ...viewJson,
      settings: {
        ...settingsJson,
        look: { ...settingsJson.look, layout: "carousel", accent: "#ABCDEF", font: "comic" },
        sections: [...settingsJson.sections, { key: "polls", shown: true, column: "main" }, { key: "about", shown: false, column: "main" }],
        leaderboards: ["messages_week", "voice_minutes"],
      },
      whoRunsIt: [{ user: person("bo"), badge: "helper" }],
    });
    expect(v.settings.look.layout).toBe("classic");
    expect(v.settings.look.font).toBe("default");
    expect(v.settings.look.accent).toBe("#abcdef");
    expect(v.settings.sections.map((s) => s.key)).toEqual([...LOBBY_SECTION_KEYS]);
    expect(v.settings.sections[0].shown).toBe(true);
    expect(v.settings.leaderboards).toEqual(["messages_week"]);
    expect(v.whoRunsIt[0].badge).toBe("mod");
  });

  it("reads the settings view and the community's lobby flags", () => {
    const s = zLobbySettingsView.parse({ settings: settingsJson, rev: 4, updatedAt: 5, canEdit: true, feed: { createdAt: 1, lastPostAt: null } });
    expect(s.feed?.lastPostAt).toBeNull();
    const org = { id: "o1", name: "N", slug: null, description: null, myRole: "MEMBER", memberCount: 1, createdAt: 1 };
    expect(zOrg.parse({ ...org, lobby: { enabled: true, seen: false } }).lobby).toEqual({ enabled: true, seen: false });
    expect(zOrg.parse(org).lobby).toBeNull();
    expect(zOrg.parse({ ...org, lobby: "weird" }).lobby).toBeNull();
  });
});

describe("the lobby's draft", () => {
  it("counts changes field by field, look fields one by one, ignoring blank additions", () => {
    const saved = base();
    expect(changeCount(saved, saved)).toBe(0);
    const d = { ...saved, tagline: "  ", faq: [{ id: "new-1", question: "", answer: "" }] };
    expect(changeCount(saved, d)).toBe(0);
    const d2 = { ...saved, about: "Hi", look: { ...saved.look, layout: "magazine" as const, font: "serif" as const } };
    expect(changedFields(saved, d2)).toEqual(["about", "look.layout", "look.font"]);
  });

  it("sends only what changed, cleaned, with the revision", () => {
    const saved = base();
    const draft: LobbySettings = {
      ...saved,
      tagline: "  Builders at night ",
      buttons: [
        { label: " Say hi ", url: null, channelId: "c1" },
        { label: "Site", url: " https://owls.example ", channelId: null },
        { label: "", url: null, channelId: null },
      ],
      faq: [
        { id: "new-3", question: "When?", answer: "Nightly" },
        { id: "q1", question: "Who?", answer: "Owls" },
      ],
      look: { ...saved.look, accent: "#ff0000" },
    };
    expect(settingsBody(saved, draft, 7)).toEqual({
      rev: 7,
      tagline: "Builders at night",
      buttons: [
        { label: "Say hi", channelId: "c1" },
        { label: "Site", url: "https://owls.example" },
      ],
      faq: [
        { question: "When?", answer: "Nightly" },
        { id: "q1", question: "Who?", answer: "Owls" },
      ],
      look: { accent: "#ff0000" },
    });
    expect(settingsBody(saved, saved, 7)).toEqual({ rev: 7 });
  });

  it("says why a draft can't be saved", () => {
    const d = base();
    expect(draftProblem(d)).toBeNull();
    expect(draftProblem({ ...d, buttons: [{ label: "", url: "https://a.example", channelId: null }] })).toMatch(/label/);
    expect(draftProblem({ ...d, buttons: [{ label: "Go", url: "http://a.example", channelId: null }] })).toMatch(/https/);
    expect(draftProblem({ ...d, buttons: [{ label: "Go", url: null, channelId: null }] })).toMatch(/link or a channel/);
    expect(draftProblem({ ...d, faq: [{ id: "a", question: "Q", answer: "" }] })).toMatch(/answer/);
    expect(draftProblem({ ...d, about: "x".repeat(2001) })).toMatch(/2000/);
    expect(draftProblem({ ...d, leaderboards: [] })).toMatch(/leaderboard/);
  });

  it("moves sections by drag and drop, joining the column they're dropped into", () => {
    const s = base().sections;
    const moved = moveSection(s, "faq", "about", "before");
    expect(moved.map((x) => x.key).slice(0, 2)).toEqual(["faq", "about"]);
    expect(moved).toHaveLength(11);
    const toSide = moveSection(s, "about", "rules", "after");
    const about = toSide.find((x) => x.key === "about")!;
    expect(about.column).toBe("side");
    expect(toSide.map((x) => x.key).indexOf("about")).toBe(toSide.map((x) => x.key).indexOf("rules") + 1);
    expect(moveSection(s, "faq", "faq", "after")).toEqual(s);
    expect(s[0].key).toBe("about"); // the original is untouched
  });

  it("keeps who runs it and its card's switch together", () => {
    const d = setWhoRunsIt(base(), false);
    expect(d.showWhoRunsIt).toBe(false);
    expect(d.sections.find((s) => s.key === "who_runs_it")?.shown).toBe(false);
    const back = setSection(d, "who_runs_it", { shown: true });
    expect(back.showWhoRunsIt).toBe(true);
    expect(setSection(d, "about", { column: "side" }).showWhoRunsIt).toBe(false);
  });

  it("orders lists, toggles boards but never the last one, and splits columns for Classic only", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b"], 5, 0)).toEqual(["a", "b"]);
    expect(toggleBoard(["messages_week"], "invites")).toEqual(["messages_week", "invites"]);
    expect(toggleBoard(["messages_week"], "messages_week")).toEqual(["messages_week"]);
    const cols = pageColumns(base().sections, "classic");
    expect(cols.side.map((s) => s.key)).toEqual(["leaderboard", "pick_roles", "rules", "who_runs_it", "links"]);
    expect(pageColumns(base().sections, "spotlight").side).toEqual([]);
  });
});

describe("the lobby as the draft shows it", () => {
  it("follows the draft's main channels and boards with what's known about them", () => {
    const v = view();
    const channels = new Map([["c2", { id: "c2", name: "art", kind: "PUBLIC", voice: false, format: "text" as const, lastActiveAt: null }]]);
    const drawn = withDraft(v, { ...v.settings, mainChannelIds: ["c2", "c1", "gone"], leaderboards: ["invites", "messages_week"] }, channels);
    expect(drawn.mainChannels.map((c) => c.id)).toEqual(["c2", "c1"]);
    expect(drawn.mainChannels[1].lastActiveAt).toBe(1_700_000_000_000);
    expect(drawn.mainChannelsPicked).toBe(true);
    expect(drawn.leaderboards.map((l) => l.board)).toEqual(["invites", "messages_week"]);
    expect(withDraft(v, v.settings, new Map()).mainChannels).toBe(v.mainChannels);
  });

  it("tells empty cards (an editor's job) from quiet ones, and a bare lobby", () => {
    const v = view();
    expect(cardState("about", v)).toBe("empty");
    expect(cardState("live_now", v)).toBe("quiet");
    expect(cardState("main_channels", v)).toBe("ok");
    expect(cardState("who_runs_it", v)).toBe("ok");
    // Nothing written yet, though the busiest channels and the owner show by themselves.
    expect(lobbyIsBare(v)).toBe(true);
    expect(lobbyIsBare({ ...v, settings: { ...v.settings, tagline: "Hello" } })).toBe(false);
    expect(lobbyIsBare({ ...v, settings: { ...v.settings, mainChannelIds: ["c1"] } })).toBe(false);
    expect(lobbyIsBare({ ...v, settings: { ...v.settings, faq: [{ id: "new-9", question: " ", answer: "" }] } })).toBe(true);
  });
});

describe("pick your roles", () => {
  const prompt = { single: true, options: [{ id: "a" }, { id: "b" }] };
  it("replaces a one-answer choice and toggles others", () => {
    expect([...togglePick(new Set(["a"]), prompt, "b")]).toEqual(["b"]);
    expect([...togglePick(new Set(["a"]), { ...prompt, single: false }, "b")].sort()).toEqual(["a", "b"]);
    expect([...togglePick(new Set(["a"]), prompt, "a")]).toEqual([]);
  });
  it("keeps answers to questions the lobby doesn't show", () => {
    expect(pickRolesAnswer(["x", "a"], ["a", "b"], new Set(["b"])).sort()).toEqual(["b", "x"]);
  });
});

describe("landing, the channel list's row and the feed URL", () => {
  const features = [LOBBY_FEATURE];
  it("lands on a lobby that's on and unseen, only with the feature", () => {
    expect(landsOnLobby({ id: "o1", lobby: { enabled: true, seen: false } }, features)).toBe(true);
    expect(landsOnLobby({ id: "o1", lobby: { enabled: true, seen: true } }, features)).toBe(false);
    expect(landsOnLobby({ id: "o1", lobby: { enabled: false, seen: false } }, features)).toBe(false);
    expect(landsOnLobby({ id: "o1", lobby: { enabled: true, seen: false } }, [])).toBe(false);
    expect(landsOnLobby({ id: "o1", lobby: null }, features)).toBe(false);
  });
  it("offers the lobby to members while it's on, and always to editors", () => {
    expect(offersLobby({ lobby: { enabled: false, seen: true } }, features, false)).toBe(false);
    expect(offersLobby({ lobby: { enabled: false, seen: true } }, features, true)).toBe(true);
    expect(offersLobby({ lobby: { enabled: true, seen: true } }, features, false)).toBe(true);
    expect(offersLobby({ lobby: { enabled: true, seen: true } }, [], true)).toBe(false);
  });
  it("builds the feed URL on the API base", () => {
    expect(lobbyFeedUrl("https://api.example/", "tok_123")).toBe("https://api.example/v1/lobby-feed/tok_123");
  });
  it("routes /lobby and the Lobby settings page", () => {
    expect(parseRoute("/lobby").section).toBe("lobby");
    expect(routeHref({ section: "lobby" })).toBe("/lobby");
    expect(parseRoute("/workspace/lobby").workspacePage).toBe("lobby");
  });
});

describe("community settings with the lobby", () => {
  const owner = zOrgPermissions.parse({ canManageOrg: true, canInvite: true, canCreateChannels: true, canViewDirectory: true, isOwner: true });
  it("puts Lobby where Home was and keeps the guide reachable", () => {
    const keys = visibleCommunityRail(["community-guide", LOBBY_FEATURE], owner).map((p) => [p.key, p.label]);
    expect(keys.slice(0, 3)).toEqual([
      ["overview", "Profile"],
      ["lobby", "Lobby"],
      ["guide", "Community guide"],
    ]);
    expect(visibleCommunityRail(["community-guide"], owner).find((p) => p.key === "guide")?.label).toBe("Home");
    expect(communityPageTitle("guide", ["community-guide", LOBBY_FEATURE])).toBe("Community guide");
    expect(communityPageTitle("lobby", [LOBBY_FEATURE])).toBe("Lobby");
  });
});

describe("the About text's Markdown", () => {
  it("parses headings, lists, quotes and paragraphs", () => {
    const blocks = parseMarkdown("# Welcome\n\nWe build **games**.\nEvery night.\n\n- one\n- two\n\n1. first\n> be kind");
    expect(blocks.map((b) => b.t)).toEqual(["h", "p", "ul", "ol", "quote"]);
    expect(blocks[1]).toMatchObject({ t: "p", c: [[{ t: "text", v: "We build " }, { t: "b" }, { t: "text", v: "." }], [{ t: "text", v: "Every night." }]] });
  });
  it("only links https, and never makes HTML", () => {
    expect(parseInline("[site](https://a.example) and [bad](javascript:alert(1))")).toEqual([
      { t: "link", href: "https://a.example", c: [{ t: "text", v: "site" }] },
      { t: "text", v: " and [bad](javascript:alert(1))" },
    ]);
    expect(parseInline("<b>hi</b> `x` *y* _z_")).toEqual([
      { t: "text", v: "<b>hi</b> " },
      { t: "code", v: "x" },
      { t: "text", v: " " },
      { t: "i", c: [{ t: "text", v: "y" }] },
      { t: "text", v: " " },
      { t: "i", c: [{ t: "text", v: "z" }] },
    ]);
    expect(parseInline("see https://a.example/x.")).toEqual([
      { t: "text", v: "see " },
      { t: "link", href: "https://a.example/x", c: [{ t: "text", v: "https://a.example/x" }] },
      { t: "text", v: "." },
    ]);
  });
});
