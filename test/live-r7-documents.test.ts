import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "../src/api/client";
import {
  addComment,
  createDocument,
  documentComments,
  documentVersions,
  getDocument,
  listDocuments,
  resolveComment,
  restoreVersion,
  saveDocument,
  setDocumentArchived,
  shareDocument,
} from "../src/sync/documents";
import type { Engine } from "../src/sync/engine";
import { serverSearch } from "../src/sync/universalSearch";
import { acceptInvite, createInvitation, createWorkspace, requestId } from "../src/sync/workspaces";
import { serverFeatures } from "./support/features";
import { linkBrowser, type Phone, type Server, startServer } from "./support/live";

/** Documents (android round 7 C4, server docs/DOCUMENTS.md) from the browser against the round 7 server. */
let server: Server;
let ann: Phone;
let bo: Phone;
let annWeb: Engine;
let boWeb: Engine;
let orgId: string;
let round7 = false;
const fail = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: unknown) => e as ApiError,
  );

beforeAll(async () => {
  server = await startServer();
  round7 = (await serverFeatures(server)).includes("documents");
  ann = await server.client("ann", "Ann");
  bo = await server.client("bo", "Bo");
  annWeb = (await linkBrowser(server, ann)).engine;
  boWeb = (await linkBrowser(server, bo)).engine;
  orgId = (await createWorkspace(annWeb, "Paper Co", null, requestId())).id;
  await acceptInvite(boWeb, (await createInvitation(annWeb, orgId, { role: "MEMBER", maxUses: 1, expiresInHours: 1 })).code);
});
afterAll(async () => {
  annWeb?.stop();
  boWeb?.stop();
  await server?.close();
});

describe("documents", () => {
  it("a workspace document: everyone may comment; a stale save is refused; versions restore; search finds it", async (t) => {
    if (!round7) return t.skip();
    const d = await createDocument(annWeb, orgId, { title: "Launch plan", content: "# Goals\n- ship the beta", access: "workspace", defaultRole: "comment", channelId: null, members: [] });
    expect(d).toMatchObject({ role: "admin", encryption: "server-readable", rev: 1 });
    const seen = await getDocument(boWeb, d.id);
    expect(seen.role).toBe("comment");
    expect((await fail(saveDocument(boWeb, d.id, 1, "Mine", "x")))?.status).toBe(403);

    const v2 = await saveDocument(annWeb, d.id, 1, "Launch plan", "# Goals\n- ship the beta\n- invite pilots");
    const stale = await fail(saveDocument(annWeb, d.id, 1, "Launch plan", "overwrite"));
    expect([stale?.status, stale?.code]).toEqual([409, "stale_revision"]);
    expect((await documentVersions(annWeb, d.id)).map((v) => v.rev).sort()).toEqual([1, 2]);
    const back = await restoreVersion(annWeb, d.id, 1);
    expect(back.rev).toBeGreaterThan(v2.rev);
    expect(back.content).toBe("# Goals\n- ship the beta");

    const c = await addComment(boWeb, d.id, "Who owns the pilot list?", "invite pilots");
    await resolveComment(annWeb, c.id, true);
    expect((await documentComments(annWeb, d.id))[0]).toMatchObject({ resolved: true, quote: "invite pilots" });

    const found = await serverSearch(boWeb, "beta", { types: "documents", limit: 5 });
    expect(found.documents?.items.map((x) => x.id)).toEqual([d.id]);
  });

  it("a restricted document is invisible, not even listed, to someone not added; archiving makes it read-only", async (t) => {
    if (!round7) return t.skip();
    const d = await createDocument(annWeb, orgId, { title: "Salaries", content: "private", access: "restricted", defaultRole: "view", channelId: null, members: [] });
    expect((await fail(getDocument(boWeb, d.id)))?.status).toBe(404);
    expect((await listDocuments(boWeb, orgId)).some((x) => x.id === d.id)).toBe(false);
    await shareDocument(annWeb, d.id, { access: "restricted", defaultRole: "view", channelId: null, members: [{ userId: bo.userId, role: "view" }] });
    expect((await getDocument(boWeb, d.id)).role).toBe("view");
    const archived = await setDocumentArchived(annWeb, d.id, true);
    expect(archived.archived).toBe(true);
    expect((await fail(saveDocument(annWeb, d.id, archived.rev, "Salaries", "edit")))?.status).toBeGreaterThanOrEqual(400);
  });
});
