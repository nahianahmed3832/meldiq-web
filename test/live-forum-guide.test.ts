import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "../src/api/client";
import { createCommunity, createCommunityChannel, updateChannel } from "../src/sync/community";
import type { Engine } from "../src/sync/engine";
import { answerOnboarding, onboarding, setGuide, setOnboarding } from "../src/sync/guide";
import { postText } from "../src/sync/forumRules";
import { threadRows } from "../src/sync/threads";
import { createRole } from "../src/sync/roles";
import { acceptInvite, createInvitation, removeConversationMember, requestId } from "../src/sync/workspaces";
import { serverFeatures } from "./support/features";
import { linkBrowser, type Phone, type Server, startServer, until } from "./support/live";

/**
 * Forums, threads, the community guide and onboarding against the real server, with the reference client playing the
 * Android phone (batches B5, B8, B8b): a phone's forum post shows here with its title and tags, a browser's post
 * reaches the phone in the same wire format, and onboarding answers give roles and open channels.
 */
let server: Server;
let ada: Phone;
let bob: Phone;
let web: Engine;
let bobWeb: Engine;
let orgId: string;
let forum: string;
let ready = false;

beforeAll(async () => {
  server = await startServer();
  const f = await serverFeatures(server);
  ready = ["forum-tags", "forum-guidelines", "community-guide", "onboarding"].every((x) => f.includes(x));
  ada = await server.client("ada", "Ada");
  bob = await server.client("bob", "Bob");
  await bob.connect();
  web = (await linkBrowser(server, ada)).engine;
  bobWeb = (await linkBrowser(server, bob)).engine;
  if (!ready) return;
  orgId = (await createCommunity(web, { name: "Sky Watchers", description: null }, requestId())).id;
  await acceptInvite(bobWeb, (await createInvitation(web, orgId, { role: "MEMBER", maxUses: 1, expiresInHours: 1 })).code);
  const ch = await createCommunityChannel(web, orgId, { name: "questions", topic: null, kind: "PUBLIC", voice: false, format: "forum", categoryId: null });
  forum = (await updateChannel(web, ch.id, { forumTags: [{ name: "Lenses" }, { name: "Events" }], guidelines: "One question per post" })).id;
  await until(() => bobWeb.state.get().conversations[forum]?.joined, 8000, "Bob in the forum");
});
afterAll(async () => {
  web?.stop();
  bobWeb?.stop();
  await server?.close();
});

describe("forum posts between the phone and the browser", () => {
  it("a phone's post shows here with its title and tags; a browser's post reaches the phone the same way", async (t) => {
    if (!ready) return t.skip();
    const tags = web.state.get().conversations[forum]!.forumTags;
    const lenses = tags.find((x) => x.name === "Lenses")!.id;
    // The phone (reference client) posts: title, text starting with it, tag ids.
    await bob.send(forum, { type: "text", text: postText("Which lens?", "For the moon"), title: "Which lens?", tags: [lenses] });
    const got = await until(async () => (await web.conversationMessages(forum)).find((m) => m.rich?.title === "Which lens?"), 8000, "the phone's post in the browser");
    expect(got.rich?.tags).toEqual([lenses]);
    expect(got.text).toBe("Which lens?\n\nFor the moon");
    // The browser posts; the phone gets the title and tags in the payload.
    await web.sendText(forum, postText("Star party", "Friday"), { rich: { title: "Star party", tags: [tags[1].id] } });
    const onPhone = await bob.waitFor(() => bob.received.find((m) => m.payload?.title === "Star party"), 8000);
    expect(onPhone.payload.tags).toEqual([tags[1].id]);
    expect(onPhone.payload.text).toBe("Star party\n\nFriday");
    // A reply in the post's thread: the Threads list counts it.
    await bob.send(forum, { type: "text", text: "A 10 mm one", threadRoot: got.id });
    await until(async () => threadRows(await web.conversationMessages(forum)).some((r) => r.rootId === got.id && r.replies === 1), 8000, "thread counted");
    expect(threadRows(await web.conversationMessages(forum)).find((r) => r.rootId === got.id)?.title).toBe("Which lens?");
  });

  it("following a post brings its replies into Activity", async (t) => {
    if (!ready) return t.skip();
    const post = (await web.conversationMessages(forum)).find((m) => m.rich?.title === "Which lens?")!;
    await web.setFollowed(post.id, true);
    expect(await web.isFollowed(post.id)).toBe(true);
    await bob.send(forum, { type: "text", text: "or a 25 mm", threadRoot: post.id });
    await until(async () => (await web.threadActivity()).some((a) => a.rootId === post.id && a.unseen > 0), 8000, "in Activity");
  });
});

describe("community guide and onboarding", () => {
  it("editors set the guide; members see it, without channels they can't open", async (t) => {
    if (!ready) return t.skip();
    const general = Object.values(web.state.get().conversations).find((c) => c.orgId === orgId && c.name === "general")!;
    const secret = await createCommunityChannel(web, orgId, { name: "mods", topic: null, kind: "PRIVATE", voice: false, format: "text", categoryId: null });
    await setGuide(web, orgId, {
      welcome: "Welcome, stargazers",
      tasks: [
        { title: "Say hi", channelId: general.id },
        { title: "Mods only", channelId: secret.id },
      ],
      resources: [],
    });
    const g = await until(() => bobWeb.state.get().orgs.find((o) => o.id === orgId)?.guide, 8000, "Bob sees the guide");
    expect(g.welcome).toBe("Welcome, stargazers");
    expect(g.tasks.map((x) => x.title)).toEqual(["Say hi"]);
    expect(((await setGuide(bobWeb, orgId, null).catch((e: unknown) => e)) as ApiError).status).toBe(403);
  });

  it("answers give roles without admin permissions and open public channels; admin roles are refused", async (t) => {
    if (!ready) return t.skip();
    const painter = await createRole(web, orgId, { name: "Observer", permissions: [] });
    const admin = await createRole(web, orgId, { name: "Banhammer", permissions: ["members.ban"] });
    const hidden = await createCommunityChannel(web, orgId, { name: "deep-sky", topic: null, kind: "PUBLIC", voice: false, format: "text", categoryId: null });
    // Bob isn't in it (the owner takes him out: since API 0.26.0 nobody leaves one channel of a community by themselves).
    await removeConversationMember(web, hidden.id, bob.userId);
    const refused = (await setOnboarding(web, orgId, true, [{ title: "Role?", single: true, required: true, options: [{ title: "Ban", roleIds: [admin.id], channelIds: [] }] }]).catch(
      (e: unknown) => e,
    )) as ApiError;
    expect(refused.code).toBe("role_not_givable");
    await setOnboarding(web, orgId, true, [
      {
        title: "What do you watch?",
        single: true,
        required: true,
        options: [
          { title: "Galaxies", roleIds: [painter.id], channelIds: [hidden.id] },
          { title: "Planets", roleIds: [], channelIds: [] },
        ],
      },
    ]);
    // The server doesn't announce an onboarding change (no org.updated); a member's app sees it on its next refresh.
    await bobWeb.refreshAll();
    expect(bobWeb.state.get().orgs.find((o) => o.id === orgId)?.onboarding).toBe(true);
    const q = await onboarding(bobWeb, orgId);
    expect(q.answered ?? null).toBeNull();
    expect(((await answerOnboarding(bobWeb, orgId, []).catch((e: unknown) => e)) as ApiError).code).toBe("answer_required");
    await answerOnboarding(bobWeb, orgId, [q.prompts[0].options[0].id]);
    await until(() => bobWeb.state.get().conversations[hidden.id]?.joined, 8000, "deep-sky opened for Bob");
    expect((await onboarding(bobWeb, orgId)).answered).toEqual([q.prompts[0].options[0].id]);
  });
});
