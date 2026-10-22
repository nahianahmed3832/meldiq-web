import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Engine } from "../src/sync/engine";
import { PERSONAL } from "../src/sync/navPrefs";
import { homeLayout, isMuted, people, unreadPeopleCount } from "../src/ui/selectors";
import { linkBrowser, type Phone, type Server, startServer, until } from "./support/live";

/**
 * Personal navigation preferences across devices against the real server: starred, sections, notification levels and
 * collapsed groups set in one browser reach the account's other browser through prefs.updated; local archive and
 * mark-unread stay where they were made.
 */
let server: Server;
let alice: Phone;
let bob: Phone;
let one: Engine;
let two: Engine;
let dm: string;
let channel: string;
let orgId: string;
const notified: string[] = [];

beforeAll(async () => {
  server = await startServer();
  alice = await server.client("alice", "Alice");
  bob = await server.client("bob", "Bob");
  dm = (await bob.req("POST", "/v1/conversations/dm", { userId: alice.userId })).conversation.id;
  orgId = (await alice.req("POST", "/v1/orgs", { name: "Acme" })).org.id;
  channel = (await alice.req("POST", `/v1/orgs/${orgId}/channels`, { name: "general", scope: "ORG", kind: "PUBLIC" })).channel.id;
  await bob.connect();
  one = (await linkBrowser(server, alice, "Browser one", { notify: (title) => notified.push(title) })).engine;
  two = (await linkBrowser(server, alice, "Browser two")).engine;
});
afterAll(async () => {
  one?.stop();
  two?.stop();
  await server?.close();
});

describe("arranging Home on one browser shows on the other", () => {
  it("starring a DM (personal document) and a channel (workspace document) reaches the second browser", async () => {
    await one.arrange(dm, { op: "place", conversationId: dm, sectionId: null, starred: true });
    await one.arrange(channel, { op: "place", conversationId: channel, sectionId: null, starred: true });
    await until(() => two.state.get().nav[PERSONAL]?.starred.includes(dm), 6000, "starred DM on browser two");
    await until(() => two.state.get().nav[orgId]?.starred.includes(channel), 6000, "starred channel on browser two");
    expect(homeLayout(two.state.get(), orgId).starred).toEqual([channel, dm]);
  });

  it("sections made on one browser, with conversations in them, appear on the other", async () => {
    await one.nav.change(orgId, { op: "addSection", id: "s_projects0001", name: "Projects" });
    await one.arrange(channel, { op: "place", conversationId: channel, sectionId: "s_projects0001", starred: false });
    await until(() => two.state.get().nav[orgId]?.sections[0]?.items.includes(channel), 6000, "section on browser two");
    const layout = homeLayout(two.state.get(), orgId);
    expect(layout.sections.map((s) => [s.name, s.ids])).toEqual([["Projects", [channel]]]);
    expect(layout.starred).toEqual([dm]);
  });

  it("edits on both browsers at once merge rather than overwrite", async () => {
    await Promise.all([one.nav.change(orgId, { op: "collapse", key: `ORG:${orgId}`, collapsed: true }), two.nav.change(orgId, { op: "addSection", id: "s_clients00001", name: "Clients" })]);
    await until(
      () => {
        const a = one.state.get().nav[orgId];
        const b = two.state.get().nav[orgId];
        return a?.collapsed.includes(`ORG:${orgId}`) && b?.collapsed.includes(`ORG:${orgId}`) && a.sections.length === 2 && b.sections.length === 2;
      },
      8000,
      "both browsers converge",
    );
  });

  it("muting a DM silences its notifications on both browsers, except a mention by name", async () => {
    await one.arrange(dm, { op: "notify", conversationId: dm, level: "none" });
    await until(() => isMuted(two.state.get(), two.state.get().conversations[dm]!), 6000, "muted on browser two");
    notified.length = 0;
    await bob.send(dm, { type: "text", text: "quiet please" });
    await until(async () => (await one.conversationMessages(dm)).some((m) => m.text === "quiet please"), 6000, "message arrives");
    expect(notified).toEqual([]);
    // Muted conversations stay out of the DMs badge, though their unread count is kept (counted just after it's stored).
    await until(() => (one.state.get().local[dm]?.unread ?? 0) > 0, 6000, "unread counted");
    expect(unreadPeopleCount(one.state.get())).toBe(0);
    await one.arrange(dm, { op: "notify", conversationId: dm, level: "all" });
    await bob.send(dm, { type: "text", text: "now you hear me" });
    await until(() => notified.length > 0, 6000, "notification after unmuting");
  });

  it("archive and mark unread stay on the browser where they were made", async () => {
    await one.setArchivedLocally(dm, true);
    expect(people(one.state.get()).map((c) => c.id)).not.toContain(dm);
    expect(people(two.state.get()).map((c) => c.id)).toContain(dm);
    await one.setArchivedLocally(dm, false);
    await one.markRead(dm);
    await one.setUnreadLocally(dm, true);
    expect(one.state.get().local[dm]?.unread).toBe(1);
    await one.setUnreadLocally(dm, false);
    expect(one.state.get().local[dm]).toMatchObject({ unread: 0, mentions: 0 });
  });
});
