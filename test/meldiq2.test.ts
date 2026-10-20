import { describe, expect, it } from "vitest";
import { zOrg } from "../src/api/schemas";
import { type App, directoryGroups } from "../src/sync/apps";
import { AnalyticsQueue, type AnalyticsEvent, resultBucket, Signals } from "../src/sync/signals";
import { analyticsScope } from "../src/sync/universalSearch";

/** Meldiq 2.0: the same cases as android ProductSignalsTest and AppRulesTest. */
const e = (n: number): AnalyticsEvent => ({ name: "app.opened", value: n });

describe("the analytics queue", () => {
  it("keeps the newest events within its capacity and hands them out in batches", () => {
    const q = new AnalyticsQueue(3);
    [1, 2, 3, 4, 5].forEach((n) => q.add(e(n)));
    expect(q.size).toBe(3);
    expect(q.take(2).map((x) => x.value)).toEqual([3, 4]);
    expect(q.take().map((x) => x.value)).toEqual([5]);
    expect(q.take()).toEqual([]);
  });

  it("puts a failed batch back in front, dropping the oldest when full", () => {
    const q = new AnalyticsQueue(3);
    [1, 2, 3].forEach((n) => q.add(e(n)));
    const batch = q.take(2);
    q.add(e(4));
    q.putBack(batch);
    expect(q.take().map((x) => x.value)).toEqual([2, 3, 4]);
  });
});

describe("signals", () => {
  const deps = (features: string[], analytics: boolean, sent: AnalyticsEvent[][]) => ({
    features: () => features,
    getExperiments: async () => ({ mode: "on", analytics, assignments: [{ experiment: "home-layout", variant: "cards", layer: "navigation" }] }),
    send: async (events: AnalyticsEvent[]) => {
      sent.push(events);
    },
    schedule: () => undefined,
  });

  it("are silent on a server without experiments: control for everyone, nothing collected", async () => {
    const sent: AnalyticsEvent[][] = [];
    const s = new Signals(deps([], true, sent));
    await s.refresh();
    expect(s.variant("home-layout", "sections")).toBe("sections");
    s.track("app.opened");
    await s.flush();
    expect(sent).toEqual([]);
  });

  it("collect nothing while the operator keeps analytics off, but still hand out assignments", async () => {
    const sent: AnalyticsEvent[][] = [];
    const s = new Signals(deps(["experiments", "analytics-events"], false, sent));
    await s.refresh();
    expect(s.variant("home-layout", "sections")).toBe("cards");
    s.track("app.opened");
    await s.flush();
    expect(sent).toEqual([]);
  });

  it("send queued events and count an exposure once", async () => {
    const sent: AnalyticsEvent[][] = [];
    const s = new Signals(deps(["experiments", "analytics-events"], true, sent));
    await s.refresh();
    s.markExposed("home-layout");
    s.markExposed("home-layout");
    s.markExposed("not-in-it");
    s.track("search.performed", { scope: "all", results: resultBucket(3) });
    await s.flush();
    expect(sent.flat()).toEqual([
      { name: "experiment.exposed", props: { experiment: "home-layout", variant: "cards" } },
      { name: "search.performed", props: { scope: "all", results: "2-5" } },
    ]);
  });
});

describe("closed analytics values", () => {
  it("bucket result counts and map search kinds to the catalogue's scopes", () => {
    expect([0, 1, 2, 5, 40].map(resultBucket)).toEqual(["0", "1", "2-5", "2-5", "6+"]);
    expect(analyticsScope("people,channels,documents")).toBe("all");
    expect(analyticsScope("people")).toBe("people");
    expect(analyticsScope("documents")).toBe("files");
    expect(analyticsScope("workspaces")).toBe("all");
  });
});

describe("the app directory", () => {
  const app = (id: string, state: string, extra: Partial<App> = {}): App => ({ id, name: id, state, actions: [], capabilities: [], ...extra }) as App;

  it("leads with essential apps and never lists planned ones", () => {
    const { recommended, more } = directoryGroups([
      app("github", "available", { tier: "essential" }),
      app("zoom", "available", { tier: "optional", featured: true }),
      app("gmail", "coming_soon", { tier: "planned", availability: "coming_soon" }),
    ]);
    expect(recommended.map((a) => a.id)).toEqual(["github"]);
    expect(more.map((a) => a.id)).toEqual(["zoom"]);
  });

  it("falls back to featured apps on a server without tiers", () => {
    const { recommended, more } = directoryGroups([app("a", "available", { featured: true }), app("b", "available")]);
    expect([recommended.map((a) => a.id), more.map((a) => a.id)]).toEqual([["a"], ["b"]]);
  });
});

describe("workspace kind", () => {
  it("is a team unless the server says community", () => {
    const base = { id: "o1", name: "Acme", slug: "acme", description: null, myRole: "OWNER", memberCount: 1, createdAt: 1 };
    expect(zOrg.parse(base).kind).toBe("team");
    expect(zOrg.parse({ ...base, kind: "community" }).kind).toBe("community");
    expect(zOrg.parse({ ...base, kind: "something-new" }).kind).toBe("team");
  });
});

describe("workspace pages for a community", () => {
  it("leave out organisation structure and the customer inbox, unless that page is open", async () => {
    const { pageShownForKind } = await import("../src/sync/workspaceRules");
    expect(pageShownForKind("structure", "team")).toBe(true);
    expect(pageShownForKind("structure", "community")).toBe(false);
    expect(pageShownForKind("inbox", "community")).toBe(false);
    expect(pageShownForKind("inbox", "community", "inbox")).toBe(true);
    expect(pageShownForKind("channels", "community")).toBe(true);
  });
});
