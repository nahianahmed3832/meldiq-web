import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { ApiError } from "../src/api/client";
import { zConversation } from "../src/api/schemas";
import { startDirect, userProfile } from "../src/sync/account";
import type { Engine } from "../src/sync/engine";
import { updateMyProfile } from "../src/sync/profile";
import { messageRequests, people } from "../src/ui/selectors";
import {
  acceptConnection,
  answerRequest,
  connect,
  connections,
  connectionState,
  messagingSettings,
  removeConnection,
  removeGroupPhoto,
  setGroupPhoto,
  setMessagingSettings,
  setPresence,
} from "../src/sync/social";
import { createGroup } from "../src/sync/workspaces";
import { serverFeatures } from "./support/features";
import { linkBrowser, type Phone, type Server, startServer, until } from "./support/live";

/**
 * People and DMs from the browser against the real server (batches B6, B6b, B12): connections, message requests and
 * who may message you, presence choices, pronouns and group photos.
 */
let server: Server;
let ada: Phone;
let erin: Phone;
let quinn: Phone;
let adaWeb: Engine;
let erinWeb: Engine;
let quinnWeb: Engine;
let ready = false;

/** A tiny valid JPEG (1×1), enough for the server's image check. */
const JPEG = Uint8Array.from(
  Buffer.from(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
    "base64",
  ),
);

beforeAll(async () => {
  server = await startServer();
  const f = await serverFeatures(server);
  ready = ["connections", "message-requests", "presence-modes", "group-photos", "pronouns"].every((x) => f.includes(x));
  ada = await server.client("ada", "Ada");
  erin = await server.client("erin", "Erin");
  quinn = await server.client("quinn", "Quinn");
  adaWeb = (await linkBrowser(server, ada)).engine;
  erinWeb = (await linkBrowser(server, erin)).engine;
  quinnWeb = (await linkBrowser(server, quinn)).engine;
});
afterAll(async () => {
  for (const e of [adaWeb, erinWeb, quinnWeb]) e?.stop();
  await server?.close();
});

describe("who may message you, and message requests", () => {
  it("a stranger's DM becomes a request: no notification, no badge, read-only until accepted", async (t) => {
    if (!ready) return t.skip();
    expect(await messagingSettings(adaWeb)).toMatchObject({ dmPolicy: "everyone" });
    expect(await setMessagingSettings(adaWeb, { dmPolicy: "connections" })).toMatchObject({ dmPolicy: "connections" });
    const dm = await startDirect(quinnWeb, ada.userId);
    await until(() => quinnWeb.state.get().conversations[dm]?.request, 6000, "Quinn's request");
    expect(quinnWeb.state.get().conversations[dm]!.request).toMatchObject({ incoming: false, limit: 3 });
    await quinnWeb.sendText(dm, "hello there");
    await until(() => messageRequests(adaWeb.state.get()).some((c) => c.id === dm), 8000, "the request in Ada's browser");
    expect(people(adaWeb.state.get()).some((c) => c.id === dm)).toBe(false);
    // Ada can't reply until she accepts: the server refuses it (the browser shows the request bar instead of a composer).
    const early = await adaWeb.sendText(dm, "too early");
    await until(async () => (await adaWeb.store.message(early))?.status === "FAILED", 8000, "reply refused");
    expect((await adaWeb.store.message(early))?.errorText).toMatch(/accept/i);
    await answerRequest(adaWeb, dm, "accept");
    await until(() => !adaWeb.state.get().conversations[dm]?.request, 8000, "accepted");
    expect(people(adaWeb.state.get()).some((c) => c.id === dm)).toBe(true);
    // Accepting connected them.
    expect(connectionState(await connections(adaWeb), quinn.userId)).toBe("connected");
  });

  it("someone your settings refuse is told so; declining hides the request and isn't revealed", async (t) => {
    if (!ready) return t.skip();
    await setMessagingSettings(adaWeb, { requestPolicy: "nobody" });
    const refused = (await startDirect(erinWeb, ada.userId).catch((x: unknown) => x)) as ApiError;
    expect(refused.code).toBe("dm_not_allowed");
    await setMessagingSettings(adaWeb, { requestPolicy: "everyone" });
    const dm = await startDirect(erinWeb, ada.userId);
    await erinWeb.sendText(dm, "hi ada");
    await until(() => messageRequests(adaWeb.state.get()).some((c) => c.id === dm), 8000, "Erin's request");
    await answerRequest(adaWeb, dm, "decline");
    await until(() => !adaWeb.state.get().conversations[dm], 8000, "gone for Ada");
    // Erin still sees her request pending.
    await erinWeb.ensureConversation(dm);
    expect(erinWeb.state.get().conversations[dm]?.request?.incoming).toBe(false);
    await setMessagingSettings(adaWeb, { dmPolicy: "everyone" });
  });
});

describe("connections", () => {
  it("request by username, accept, and remove; crossed requests connect at once", async (t) => {
    if (!ready) return t.skip();
    expect(await connect(adaWeb, { username: `@${erin.username}` })).toBe("pending");
    await until(async () => connectionState(await connections(erinWeb), ada.userId) === "received", 6000, "Erin sees Ada's request");
    await acceptConnection(erinWeb, ada.userId);
    expect(connectionState(await connections(adaWeb), erin.userId)).toBe("connected");
    await removeConnection(adaWeb, erin.userId);
    expect(connectionState(await connections(erinWeb), ada.userId)).toBe("none");
    // Both ask: the second request accepts the first.
    expect(await connect(adaWeb, { userId: erin.userId })).toBe("pending");
    expect(await connect(erinWeb, { userId: ada.userId })).toBe("accepted");
  });
});

describe("presence, pronouns and group photos", () => {
  it("idle and do not disturb show to others; do not disturb pauses notifications; invisible looks offline", async (t) => {
    if (!ready) return t.skip();
    await setPresence(adaWeb, "idle", Date.now() + 3_600_000, false);
    expect((await userProfile(erinWeb, ada.userId)).presence).toBe("idle");
    await until(() => adaWeb.state.get().me?.presenceMode === "idle", 6000, "Ada's own choice");
    await setPresence(adaWeb, "dnd", null, false);
    await until(() => (adaWeb.state.get().me?.notificationsPausedUntil ?? 0) > Date.now(), 6000, "notifications paused");
    expect((await userProfile(erinWeb, ada.userId)).presence).toBe("dnd");
    await setPresence(adaWeb, "invisible", null, true);
    expect((await userProfile(erinWeb, ada.userId)).presence).toBe("offline");
    await until(() => !adaWeb.state.get().me?.notificationsPausedUntil, 6000, "pause ended with do not disturb");
    await setPresence(adaWeb, "auto", null, false);
  });

  it("pronouns appear on the profile; a group's admin sets its photo and members see it", async (t) => {
    if (!ready) return t.skip();
    await updateMyProfile(adaWeb, { pronouns: "she/her" });
    expect((await userProfile(erinWeb, ada.userId)).pronouns).toBe("she/her");
    const g = await createGroup(adaWeb, "Lab trip", [erin.userId, quinn.userId]);
    await setGroupPhoto(adaWeb, g.id, JPEG);
    const photoRev = async () => (await erinWeb.api.json("GET", `/v1/conversations/${g.id}`, z.object({ conversation: zConversation }))).conversation.photoRev;
    await until(photoRev, 8000, "Erin sees the photo");
    expect((await erinWeb.api.bytes(`/v1/conversations/${g.id}/photo`)).length).toBeGreaterThan(0);
    // A member who isn't an admin can't change it.
    expect(((await setGroupPhoto(erinWeb, g.id, JPEG).catch((x: unknown) => x)) as ApiError).status).toBe(403);
    await removeGroupPhoto(adaWeb, g.id);
  });
});
