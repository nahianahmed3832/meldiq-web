import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, type Phone, testAddress } from "./phone";

/**
 * Background notifications (docs/MELDIQ_WEB_PUSH.md), against the real server: the service worker receives a wake-up
 * (delivered here through Chromium's DevTools protocol, as Firebase would deliver the server's {"w":"1"}), signs in as
 * this browser, and shows what's waiting, following the app's own rules. Firebase itself isn't involved: this browser
 * build has no Google push service and the test server sends no wake-ups. Chromium only.
 */
test.skip(({ browserName }) => browserName !== "chromium", "DevTools push delivery is Chromium's");
test.use({ permissions: ["notifications"] });

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

/** The app under test (playwright.config.ts WEB_PORT). */
const origin = () => "http://127.0.0.1:5181";

/** Delivers one push to this site's service worker, as the browser's push service would. */
async function deliverPush(context: BrowserContext, page: Page): Promise<void> {
  const cdp = await context.newCDPSession(page);
  const registrationId = await new Promise<string>((resolve) => {
    cdp.on("ServiceWorker.workerRegistrationUpdated", (e: { registrations: { registrationId: string; scopeURL: string; isDeleted: boolean }[] }) => {
      const r = e.registrations.find((x) => x.scopeURL.startsWith(origin()) && !x.isDeleted);
      if (r) resolve(r.registrationId);
    });
    void cdp.send("ServiceWorker.enable");
  });
  await cdp.send("ServiceWorker.deliverPushMessage", { origin: origin(), registrationId, data: JSON.stringify({ data: { w: "1" } }) });
}

/** The notifications this site's service worker is showing. */
const shown = (page: Page) =>
  page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return (await reg.getNotifications()).map((n) => ({ title: n.title, body: n.body, tag: n.tag, url: (n.data as { url?: string } | null)?.url ?? null }));
  });

async function setUp(page: Page): Promise<{ alice: Phone; bob: Phone; dm: string }> {
  const alice = await newPhone("alice", "Alice Rahman");
  const bob = await newPhone("bob", "Bob Chen");
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id as string;
  await alice.connect();
  await bob.connect();
  await link(page, alice);
  // The service worker is installed and controls the app.
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 15_000 }).toBe(true);
  return { alice, bob, dm };
}

test("with Meldiq closed, a wake-up shows who wrote and their newest message, and opens that conversation", async ({ page, context }) => {
  const { bob, dm } = await setUp(page);
  // Notifications were allowed for this site in the browser (never chosen in Meldiq): they're on.
  await page.goto("about:blank"); // no Meldiq page open any more: the browser's connection is closed
  await bob.send(dm, { type: "text", text: "are you there?" });
  await bob.send(dm, { type: "text", text: "call me" });
  await new Promise((r) => setTimeout(r, 1000));
  await deliverPush(context, page);
  const viewer = await context.newPage();
  await viewer.goto(origin() + "/#/settings/notifications");
  await expect.poll(() => shown(viewer), { timeout: 15_000 }).toContainEqual({ title: "Bob Chen", body: "2 new messages: call me", tag: dm, url: `/dms/c/${dm}` });
  // A click (the service worker tells the open page where to go): the conversation opens, once the app is running.
  await expect(viewer.locator(":is(.app[data-connection=online])").first()).toBeVisible({ timeout: 15_000 });
  await viewer.waitForTimeout(500);
  await viewer.evaluate((href) => navigator.serviceWorker.dispatchEvent(new MessageEvent("message", { data: { type: "meldiq-open", href } })), `/dms/c/${dm}`);
  await expect(viewer).toHaveURL(new RegExp(`/dms/c/${dm}$`));
});

test("a muted conversation's messages wake nothing; with Meldiq open, the page shows them itself", async ({ page, context }) => {
  test.skip(process.env.ORBIT_E2E_BUILD === "1", "mutes through the development build's engine hook");
  const { bob, dm } = await setUp(page);
  await page.evaluate(async (id) => {
    const engine = (window as unknown as { __orbit: { arrange(id: string, op: unknown): Promise<void> } }).__orbit;
    await engine.arrange(id, { op: "notify", conversationId: id, level: "none" });
  }, dm);
  await page.goto("about:blank");
  await bob.send(dm, { type: "text", text: "quiet please" });
  await new Promise((r) => setTimeout(r, 1000));
  await deliverPush(context, page);
  const viewer = await context.newPage();
  await viewer.goto(origin() + "/#/settings/notifications");
  await new Promise((r) => setTimeout(r, 3000));
  expect((await shown(viewer)).filter((n) => n.tag === dm)).toEqual([]);
  // The page in front: a wake-up only makes it connect again; no notification on top of the page.
  await deliverPush(context, viewer);
  await new Promise((r) => setTimeout(r, 2000));
  expect((await shown(viewer)).filter((n) => n.tag === dm)).toEqual([]);
});

test("with Meldiq closed, a ringing call shows as an incoming call that opens its conversation", async ({ page, context }) => {
  test.skip(!process.env.ORBIT_E2E_LIVEKIT, "calls need the local LiveKit (brew install livekit)");
  const { bob, dm } = await setUp(page);
  await page.goto("about:blank");
  // Bob calls as the phone app does: the call API, then the key in an encrypted call_invite.
  const res = await bob.req("POST", "/v1/calls", { conversationId: dm, video: false });
  await bob.send(dm, { type: "call_invite", callId: res.call.id, video: false, e2eeKey: "k".repeat(44) }, "control");
  await new Promise((r) => setTimeout(r, 1000));
  await deliverPush(context, page);
  const viewer = await context.newPage();
  await viewer.goto(origin() + "/#/settings/notifications");
  await expect.poll(() => shown(viewer), { timeout: 15_000 }).toContainEqual({ title: "Bob Chen", body: "Incoming voice call", tag: `call-${dm}`, url: `/dms/c/${dm}` });
  await bob.req("POST", `/v1/calls/${res.call.id}/end`).catch(() => undefined);
});
