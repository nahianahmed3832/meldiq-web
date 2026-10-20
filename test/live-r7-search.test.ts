import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sendFiles } from "../src/sync/attachments";
import type { Engine } from "../src/sync/engine";
import { serverSearch } from "../src/sync/universalSearch";
import { acceptInvite, createChannel, createInvitation, createWorkspace, requestId } from "../src/sync/workspaces";
import { serverFeatures } from "./support/features";
import { linkBrowser, type Phone, type Server, startServer, until } from "./support/live";

/** Universal search (android round 7 C2, server docs/SEARCH.md) from the browser against the round 7 server. */
let server: Server;
let ann: Phone;
let bo: Phone;
let annWeb: Engine;
let boWeb: Engine;
let orgId: string;
let round7 = false;

beforeAll(async () => {
  server = await startServer();
  round7 = (await serverFeatures(server)).includes("search");
  ann = await server.client("ann", "Ann Lee");
  bo = await server.client("bo", "Bo Park");
  annWeb = (await linkBrowser(server, ann)).engine;
  boWeb = (await linkBrowser(server, bo)).engine;
  orgId = (await createWorkspace(annWeb, "Northwind Design", null, requestId())).id;
  await acceptInvite(boWeb, (await createInvitation(annWeb, orgId, { role: "MEMBER", maxUses: 1, expiresInHours: 1 })).code);
});
afterAll(async () => {
  annWeb?.stop();
  boWeb?.stop();
  await server?.close();
});

describe("universal search", () => {
  it("finds people, channels you may open (joined or not) and workspaces; a private channel stays hidden; pages with a cursor", async (t) => {
    if (!round7) return t.skip();
    for (const name of ["design-reviews", "design-crit", "design-ops"]) await createChannel(annWeb, orgId, { name, topic: null, scope: "ORG", scopeId: null, kind: "PUBLIC" });
    await createChannel(annWeb, orgId, { name: "design-secret", topic: null, scope: "ORG", scopeId: null, kind: "PRIVATE" });

    const r = await serverSearch(boWeb, "design", { types: "people,channels,workspaces,groups,documents", limit: 2 });
    expect(r.workspaces?.items.map((w) => w.name)).toEqual(["Northwind Design"]);
    expect(r.channels?.items).toHaveLength(2);
    expect(r.channels?.next).toBeTruthy();
    const rest = await serverSearch(boWeb, "design", { types: "channels", limit: 10, cursor: r.channels!.next });
    const names = [...r.channels!.items, ...rest.channels!.items].map((c) => c.name);
    expect(names.sort()).toEqual(["design-crit", "design-ops", "design-reviews"]);
    expect(names).not.toContain("design-secret");

    const people = await serverSearch(boWeb, "ann", { types: "people", limit: 5 });
    expect(people.people?.items.map((p) => p.id)).toEqual([ann.userId]);
  });

  it("files and pinned messages are searched on this browser only", async () => {
    const dm = (await bo.req("POST", "/v1/conversations/dm", { userId: ann.userId })).conversation.id as string;
    await until(() => !!annWeb.state.get().conversations[dm], 8000, "DM");
    const data = new TextEncoder().encode("q3 numbers");
    const id = await sendFiles(annWeb, dm, [{ name: "Q3-budget.xlsx", type: "application/octet-stream", size: data.byteLength, bytes: async () => data }], "the budget");
    expect((await annWeb.searchFiles("budget")).map((f) => f.ref.name)).toEqual(["Q3-budget.xlsx"]);
    await annWeb.setPinned(
      (await annWeb.conversationMessages(dm)).find((m) => m.id === id)!,
      true,
    );
    expect((await annWeb.searchPinned("budget")).map((m) => m.id)).toEqual([id]);
    expect(await annWeb.searchPinned("nothing")).toEqual([]);
  });
});
