import { describe, expect, it } from "vitest";
import { zOrg } from "../src/api/schemas";
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

describe("signals when the network or server fails", () => {
  it("never throw into the caller and keep the events for the next try", async () => {
    let fail = true;
    const sent: AnalyticsEvent[][] = [];
    const s = new Signals({
      features: () => ["experiments", "analytics-events"],
      getExperiments: async () => ({ mode: "on", analytics: true, assignments: [] }),
      send: async (events) => {
        if (fail) throw new Error("offline");
        sent.push(events);
      },
      schedule: () => undefined,
    });
    await s.refresh();
    s.track("message.sent", { surface: "channel" });
    await expect(s.flush()).resolves.toBeUndefined();
    fail = false;
    await s.flush();
    expect(sent.flat().map((x) => x.name)).toEqual(["message.sent"]);
  });

  it("keep the established experience when the experiments request fails", async () => {
    const s = new Signals({
      features: () => ["experiments", "analytics-events"],
      getExperiments: async () => {
        throw new Error("500");
      },
      send: async () => undefined,
      schedule: () => undefined,
    });
    await expect(s.refresh()).resolves.toBeUndefined();
    expect(s.variant("home-layout", "sections")).toBe("sections");
    expect(s.enabled).toBe(false);
  });
});

describe("closed analytics values", () => {
  it("bucket result counts and map search kinds to the catalogue's scopes", () => {
    expect([0, 1, 2, 5, 40].map(resultBucket)).toEqual(["0", "1", "2-5", "2-5", "6+"]);
    expect(analyticsScope("people,channels,groups")).toBe("all");
    expect(analyticsScope("people")).toBe("people");
    expect(analyticsScope("workspaces")).toBe("all");
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
