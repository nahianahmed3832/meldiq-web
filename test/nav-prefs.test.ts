import { describe, expect, it } from "vitest";
import { ApiError } from "../src/api/client";
import { applyOp, EMPTY_PREFS, levelOf, type NavPrefs, NavSync, type NavSyncHost, newSectionId, placed, placeOf, replay } from "../src/sync/navPrefs";

const base: NavPrefs = { starred: ["a", "b"], sections: [{ id: "s_1", name: "Projects", items: ["c"], collapsed: false }], collapsed: [], notify: {} };

describe("navigation preference rules (android NavPrefsRules)", () => {
  it("places a conversation in exactly one place", () => {
    const p = applyOp(base, { op: "place", conversationId: "a", sectionId: "s_1", starred: false });
    expect(p.starred).toEqual(["b"]);
    expect(p.sections[0].items).toEqual(["c", "a"]);
    expect(placeOf(p, "a")).toEqual({ k: "section", id: "s_1" });
    const back = applyOp(p, { op: "place", conversationId: "a", sectionId: null, starred: true });
    expect(back.starred).toEqual(["b", "a"]);
    expect(back.sections[0].items).toEqual(["c"]);
    expect(placeOf(applyOp(back, { op: "place", conversationId: "a", sectionId: null, starred: false }), "a")).toEqual({ k: "default" });
    expect([...placed(base)].sort()).toEqual(["a", "b", "c"]);
  });

  it("ignores a move into a section that doesn't exist", () => {
    expect(applyOp(base, { op: "place", conversationId: "z", sectionId: "s_gone", starred: false })).toBe(base);
  });

  it("moves within Starred and keeps the ends put", () => {
    expect(applyOp(base, { op: "move", conversationId: "b", delta: -1 }).starred).toEqual(["b", "a"]);
    expect(applyOp(base, { op: "move", conversationId: "a", delta: -1 }).starred).toEqual(["a", "b"]);
    expect(applyOp(base, { op: "move", conversationId: "b", delta: 5 }).starred).toEqual(["a", "b"]);
  });

  it("stores notification levels other than the default", () => {
    const muted = applyOp(base, { op: "notify", conversationId: "a", level: "none" });
    expect(levelOf(muted, "a")).toBe("none");
    expect(levelOf(muted, "b")).toBe("all");
    expect(applyOp(muted, { op: "notify", conversationId: "a", level: "all" }).notify).toEqual({});
    expect(levelOf(undefined, "x")).toBe("all");
  });

  it("adds, renames, collapses and deletes sections; deleting returns its conversations to their groups", () => {
    let p = applyOp(EMPTY_PREFS, { op: "addSection", id: "s_x", name: "  Clients  " });
    expect(p.sections).toEqual([{ id: "s_x", name: "Clients", items: [], collapsed: false }]);
    expect(applyOp(p, { op: "addSection", id: "s_x", name: "dup" })).toBe(p);
    expect(applyOp(p, { op: "addSection", id: "s_y", name: "   " })).toBe(p);
    p = applyOp(p, { op: "renameSection", id: "s_x", name: "Customers" });
    p = applyOp(p, { op: "place", conversationId: "q", sectionId: "s_x", starred: false });
    p = applyOp(p, { op: "collapseSection", id: "s_x", collapsed: true });
    expect(p.sections[0]).toMatchObject({ name: "Customers", items: ["q"], collapsed: true });
    p = applyOp(p, { op: "deleteSection", id: "s_x" });
    expect(placeOf(p, "q")).toEqual({ k: "default" });
    const full = Array.from({ length: 30 }, (_, i) => i).reduce((acc, i) => applyOp(acc, { op: "addSection", id: `s_${i}`, name: `S${i}` }), EMPTY_PREFS);
    expect(applyOp(full, { op: "addSection", id: "s_31", name: "one too many" }).sections).toHaveLength(30);
  });

  it("collapses built-in groups by key", () => {
    const p = applyOp(EMPTY_PREFS, { op: "collapse", key: "TEAM:t1", collapsed: true });
    expect(applyOp(p, { op: "collapse", key: "TEAM:t1", collapsed: true }).collapsed).toEqual(["TEAM:t1"]);
    expect(applyOp(p, { op: "collapse", key: "TEAM:t1", collapsed: false }).collapsed).toEqual([]);
  });

  it("makes section ids the server accepts", () => {
    for (let i = 0; i < 20; i++) expect(newSectionId()).toMatch(/^s_[a-z0-9]{12}$/);
  });
});

/** A server and a store in memory, with a switch for being offline and a way to write as "another device". */
function fakeHost() {
  const server: Record<string, { rev: number; prefs: NavPrefs }> = {};
  const saved = new Map<string, unknown>();
  const published: Record<string, NavPrefs>[] = [];
  let offline = false;
  let puts = 0;
  const host: NavSyncHost = {
    get: async (path) => {
      if (offline) throw new ApiError(0, "network", "offline");
      const ws = decodeURIComponent(path.split("/").pop()!);
      const d = server[ws] ?? { rev: 0, prefs: EMPTY_PREFS };
      return { workspaceId: ws, rev: d.rev, prefs: d.prefs };
    },
    put: async (path, body) => {
      if (offline) throw new ApiError(0, "network", "offline");
      puts++;
      const ws = decodeURIComponent(path.split("/").pop()!);
      if (ws === "gone") throw new ApiError(404, "workspace_not_found", "Workspace not found");
      const { baseRev, prefs } = body as { baseRev: number; prefs: NavPrefs };
      const d = server[ws] ?? { rev: 0, prefs: EMPTY_PREFS };
      if (baseRev !== d.rev) throw new ApiError(409, "stale_preferences", "stale", { current: { workspaceId: ws, rev: d.rev, prefs: d.prefs } });
      server[ws] = { rev: d.rev + 1, prefs };
      return { workspaceId: ws, rev: d.rev + 1, prefs };
    },
    load: async (k) => saved.get(k),
    save: async (k, v) => {
      saved.set(k, structuredClone(v));
    },
    publish: (docs) => published.push(docs),
  };
  return {
    host,
    server,
    saved,
    last: () => published[published.length - 1],
    setOffline: (v: boolean) => (offline = v),
    puts: () => puts,
    otherDevice: (ws: string, prefs: NavPrefs) => {
      const d = server[ws] ?? { rev: 0, prefs: EMPTY_PREFS };
      server[ws] = { rev: d.rev + 1, prefs };
    },
  };
}

describe("syncing preferences (android NavPreferences)", () => {
  it("shows a change at once and stores it on the server with the revision it was based on", async () => {
    const f = fakeHost();
    const sync = new NavSync(f.host);
    await sync.refresh(["personal"]);
    await sync.change("personal", { op: "place", conversationId: "a", sectionId: null, starred: true });
    expect(f.last().personal.starred).toEqual(["a"]);
    expect(f.server.personal).toMatchObject({ rev: 1, prefs: { starred: ["a"] } });
    expect(f.saved.get("nav.pending")).toEqual({});
  });

  it("merges with a change another device made meanwhile instead of overwriting it", async () => {
    const f = fakeHost();
    const sync = new NavSync(f.host);
    await sync.refresh(["o1"]);
    f.otherDevice("o1", { ...EMPTY_PREFS, starred: ["from-phone"] });
    await sync.change("o1", { op: "place", conversationId: "from-web", sectionId: null, starred: true });
    expect(f.server.o1.prefs.starred).toEqual(["from-phone", "from-web"]);
    expect(f.last().o1.starred).toEqual(["from-phone", "from-web"]);
  });

  it("keeps changes made offline, across a reload, and sends them when back", async () => {
    const f = fakeHost();
    const first = new NavSync(f.host);
    await first.refresh(["personal"]);
    f.setOffline(true);
    await first.change("personal", { op: "notify", conversationId: "dm1", level: "none" });
    expect(f.last().personal.notify).toEqual({ dm1: "none" });
    expect(f.server.personal).toBeUndefined();
    // A reload: a new sync object finds the unsent change in storage.
    const second = new NavSync(f.host);
    f.setOffline(false);
    await second.refresh(["personal"]);
    expect(f.server.personal.prefs.notify).toEqual({ dm1: "none" });
  });

  it("drops changes for a workspace the person has left instead of retrying them forever", async () => {
    const f = fakeHost();
    const sync = new NavSync(f.host);
    await sync.change("gone", { op: "place", conversationId: "x", sectionId: null, starred: true });
    expect(f.saved.get("nav.pending")).toEqual({});
    await sync.flush();
    expect(f.puts()).toBe(1);
  });

  it("replays several pending changes in order", () => {
    const p = replay(EMPTY_PREFS, [
      { op: "addSection", id: "s_a", name: "A" },
      { op: "place", conversationId: "c1", sectionId: "s_a", starred: false },
      { op: "place", conversationId: "c2", sectionId: "s_a", starred: false },
      { op: "move", conversationId: "c2", delta: -1 },
    ]);
    expect(p.sections[0].items).toEqual(["c2", "c1"]);
  });
});
