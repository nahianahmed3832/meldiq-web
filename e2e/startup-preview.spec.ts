import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ context }) => context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() }));

test("a return draws saved messages at latest before startup requests finish, then replaces them", async ({ page }, info) => {
  const alice = await newPhone("fastreturn", "Fast Return");
  const bob = await newPhone("fastpeer", "Fast Peer");
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id;
  // Controlled history responses keep this UI regression runnable against older pairing-only test backends.
  const events = Array.from({ length: 65 }, (_, i) => ({
    id: `m_startup_${i + 1}`,
    conversationId: dm,
    serverTs: Date.now() + i,
    sentAt: Date.now() + i,
    cls: "message",
    senderUserId: bob.userId,
    senderDeviceId: bob.deviceId,
    payload: { type: "text", text: `Saved startup message ${i + 1}` },
    mentionAll: false,
    importedBy: null,
  }));
  let returning = false;
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  const blocked = new Set(["/v1/server-info", "/v1/users/me", "/v1/orgs", "/v1/conversations", "/v2/messages/summary", `/v2/conversations/${dm}/messages`]);
  await page.route("**/*", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (returning && blocked.has(pathname)) await held;
    if (pathname === `/v2/conversations/${dm}/messages`) return route.fulfill({ json: { messages: events.slice(-60).reverse(), changes: [], more: true } });
    if (pathname === "/v2/messages/summary") return route.fulfill({ json: { conversations: [{ conversationId: dm, last: events.at(-1), readUpTo: 0, unread: events.length, mentions: 0 }] } });
    await route.continue();
  });
  await link(page, alice);
  await page.goto(`/dms/c/${dm}`);
  const messages = page.getByRole("log", { name: "Messages" });
  await expect(messages).toHaveAttribute("aria-busy", "false");
  await expect(messages.getByText("Saved startup message 65", { exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const engine = (window as unknown as { __orbit: { snapshots: { flush(): Promise<void> }; stop(): void } }).__orbit;
    await engine.snapshots.flush();
    engine.stop();
  });
  // The new item only exists on the server when the page returns.
  events.push({ ...events.at(-1)!, id: "m_startup_fresh", serverTs: Date.now() + 1000, payload: { type: "text", text: "Fresh startup message from the server" } });
  returning = true;
  try {
    await page.reload();
    await expect(messages).toHaveAttribute("aria-busy", "true");
    await expect(messages.getByText("Saved startup message 65", { exact: true })).toBeVisible();
    await expect(messages.getByText("Fresh startup message from the server", { exact: true })).toHaveCount(0);
    await expect.poll(() => messages.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight)).toBeLessThan(2);
    await page.screenshot({ path: `/tmp/meldiq-startup-preview-${info.project.name}.png` });
  } finally {
    release();
  }
  await expect(messages).toHaveAttribute("aria-busy", "false");
  await expect(messages.getByText("Fresh startup message from the server", { exact: true })).toBeVisible();
});
