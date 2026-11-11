import { expect, type Page, test } from "@playwright/test";
import { expectSignedOut, link } from "./link";
import { newPhone, testAddress } from "./phone";

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

// A failure saves what each page showed (multi-page tests get no snapshot otherwise).
test.afterEach(async ({ context }, info) => {
  if (info.status === info.expectedStatus) return;
  for (const [i, p] of context.pages().entries()) {
    const text = await p
      .locator("body")
      .innerText()
      .catch((e: Error) => `unreadable: ${e.message}`);
    await info.attach(`page-${i}.txt`, { body: `${p.url()}\n\n${text}`, contentType: "text/plain" });
  }
});

test("a linked browser and the phone stay in sync through the server, and signing out erases the browser", async ({ page }) => {
  const alice = await newPhone("alice", "Alice Rahman");
  const bob = await newPhone("bob", "Bob Chen");
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id as string;
  await alice.connect();
  await bob.connect();

  await link(page, alice);

  // Someone else writes: it appears without a reload, decrypted in the browser.
  await bob.send(dm, { type: "text", text: "Hello from Bob's phone" });
  const row = page.getByRole("complementary", { name: "Conversations" }).getByRole("link", { name: /Bob Chen/ });
  await expect(row).toBeVisible();
  await expect(row).toHaveAccessibleName(/1 unread/);
  await row.click();
  await expect(page.getByText("Hello from Bob's phone")).toBeVisible();

  // The browser writes: Bob's device and the account's own phone both receive it.
  const composer = page.getByLabel("Message Bob Chen");
  await composer.fill("Reply typed in the browser ✓");
  await composer.press("Enter");
  await expect.poll(() => bob.received.find((m) => m.payload.text === "Reply typed in the browser ✓")?.senderUserId, { timeout: 10_000 }).toBe(alice.userId);
  await expect.poll(() => alice.received.some((m) => m.payload.text === "Reply typed in the browser ✓"), { timeout: 10_000 }).toBe(true);
  await expect(page.getByLabel("Delivered").first()).toBeVisible();

  // Typing straight on after Enter starts a new message: neither joins the one still going out.
  await composer.fill("First quick one");
  await composer.press("Enter");
  await composer.pressSequentially("Second quick one");
  await composer.press("Enter");
  await expect.poll(() => bob.received.filter((m) => /quick one/.test(m.payload.text ?? "")).map((m) => m.payload.text), { timeout: 10_000 }).toEqual(["First quick one", "Second quick one"]);

  // The account's phone writes: the browser shows it as the account's own message.
  await alice.send(dm, { type: "text", text: "Sent from my phone" });
  await expect(page.getByText("Sent from my phone")).toBeVisible();

  // Kept on this computer and signed in again with the device key after a reload.
  await page.reload();
  await expect(page.locator(":is(.app[data-connection=online])").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Reply typed in the browser ✓")).toBeVisible();

  // Sign out: the server lists the browser as removed, and the browser is back at the link screen.
  await page.goto("/settings/you");
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await page.getByRole("dialog", { name: "Log out of Meldiq?" }).getByRole("button", { name: "Log out", exact: true }).click();
  await expectSignedOut(page);
  const devices = (await alice.req("GET", "/v1/devices")).devices as { name: string; revokedAt: number | null }[];
  expect(devices.filter((d) => /^(Meldiq|Orbit) Web/.test(d.name)).every((d) => d.revokedAt !== null)).toBe(true);

  await alice.disconnect();
  await bob.disconnect();
});

test("removing the browser from the phone signs it out and erases what it kept", async ({ page }) => {
  const alice = await newPhone("alice", "Alice Rahman");
  await link(page, alice);
  const web = ((await alice.req("GET", "/v1/devices")).devices as { id: string; name: string }[]).find((d) => /^(Meldiq|Orbit) Web/.test(d.name))!;
  await alice.req("DELETE", `/v1/devices/${web.id}`);
  await expect(page.getByRole("heading", { name: "Signed out" })).toBeVisible();
  await expect(page.getByText(/removed from your account/)).toBeVisible();
  await page.getByRole("button", { name: "Link this browser again" }).click();
  await expectSignedOut(page);
});

test("several tabs share delivery, send from either tab, preserve drafts and hand off after closing", async ({ page, context }) => {
  test.setTimeout(180000);
  const alice = await newPhone("tabsalice", "Alice Rahman");
  const bob = await newPhone("tabsbob", "Bob Chen");
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id as string;
  await bob.connect();
  await link(page, alice);
  await page.goto(`/dms/c/${dm}`);
  const second = await context.newPage();
  await second.goto(`/dms/c/${dm}`);
  for (const tab of [page, second]) await expect(tab.locator(".app[data-connection=online]").first()).toBeVisible();
  await bob.send(dm, { type: "text", text: "Received in every tab" });
  for (const tab of [page, second]) await expect(tab.getByRole("log", { name: "Messages" })).toContainText("Received in every tab");
  await second.getByLabel("Message Bob Chen", { exact: true }).fill("Sent from the second tab");
  await second.getByLabel("Message Bob Chen", { exact: true }).press("Enter");
  for (const tab of [page, second]) await expect(tab.getByRole("log", { name: "Messages" })).toContainText("Sent from the second tab");
  await expect.poll(() => bob.received.filter((m) => m.payload.text === "Sent from the second tab").length).toBe(1);
  await page.getByLabel("Message Bob Chen", { exact: true }).fill("Sent from the first tab");
  await page.getByLabel("Message Bob Chen", { exact: true }).press("Enter");
  await expect(second.getByRole("log", { name: "Messages" })).toContainText("Sent from the first tab");

  // More tabs than the API's per-device socket limit still use a single live connection.
  const extra = await Promise.all(
    Array.from({ length: 3 }, async () => {
      const tab = await context.newPage();
      await tab.goto(`/dms/c/${dm}`);
      await expect(tab.locator(".app[data-connection=online]").first()).toBeVisible();
      return tab;
    }),
  );
  await expect.poll(() => second.evaluate(async () => (await navigator.locks.query()).held?.filter((l) => l.name?.startsWith("meldiq-realtime-v1:")).length)).toBe(1);
  await bob.send(dm, { type: "text", text: "Five tabs stay synchronized" });
  for (const tab of [page, second, ...extra]) await expect(tab.getByRole("log", { name: "Messages" })).toContainText("Five tabs stay synchronized");

  await second.bringToFront();
  await expect
    .poll(
      async () =>
        (
          await Promise.all(
            [page, second, ...extra].map((tab) =>
              tab.evaluate(() => (window as unknown as { __orbit: { realtime: { canNotify(id: string): boolean } } }).__orbit.realtime.canNotify("another-conversation")),
            ),
          )
        ).filter(Boolean).length,
    )
    .toBe(1);
  // The browser can freeze a background owner; another tab keeps delivery alive, then the resumed view catches up.
  await page.evaluate(() => document.dispatchEvent(new Event("freeze")));
  await bob.send(dm, { type: "text", text: "Arrived while one tab was suspended" });
  await expect(second.getByRole("log", { name: "Messages" })).toContainText("Arrived while one tab was suspended");
  await page.evaluate(() => document.dispatchEvent(new Event("resume")));
  await expect(page.getByRole("log", { name: "Messages" })).toContainText("Arrived while one tab was suspended");

  const draftBytes = (tab: Page) =>
    tab.evaluate(() =>
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith("meldiq.tab-drafts:"))
        .map((k) => sessionStorage.getItem(k))
        .join(""),
    );
  const firstBefore = await draftBytes(page);
  await page.getByLabel("Message Bob Chen", { exact: true }).fill("First tab private draft");
  await expect.poll(() => draftBytes(page)).not.toBe(firstBefore);
  const secondBefore = await draftBytes(second);
  await second.getByLabel("Message Bob Chen", { exact: true }).fill("Second tab private draft");
  await expect.poll(() => draftBytes(second)).not.toBe(secondBefore);
  await second.reload();
  await expect(second.getByLabel("Message Bob Chen", { exact: true })).toHaveValue("Second tab private draft");
  await page.reload();
  await expect(page.getByLabel("Message Bob Chen", { exact: true })).toHaveValue("First tab private draft");
  // Close all but one; ownership transfers without showing a takeover screen or losing the conversation.
  await Promise.all([page.close(), ...extra.map((tab) => tab.close())]);
  await expect(second.locator(".app[data-connection=online]").first()).toBeVisible();
  await bob.send(dm, { type: "text", text: "Still receiving after other tabs close" });
  await expect(second.getByRole("log", { name: "Messages" })).toContainText("Still receiving after other tabs close");

  // Even a tab unable to reach the API must hide private content when this browser signs out.
  const offline = await context.newPage();
  await offline.goto(`/dms/c/${dm}`);
  await expect(offline.getByRole("log", { name: "Messages" })).toContainText("Received in every tab");
  await offline.route("**/v1/**", (route) => route.abort());
  await offline.route("**/v2/**", (route) => route.abort());
  await second.goto("/settings/you");
  await second.getByRole("button", { name: "Log out", exact: true }).click();
  await second.getByRole("dialog", { name: "Log out of Meldiq?" }).getByRole("button", { name: "Log out", exact: true }).click();
  await expectSignedOut(second);
  await expect(offline.getByRole("heading", { name: "Signed out" })).toBeVisible();
  await expect(offline.getByRole("log", { name: "Messages" })).toHaveCount(0);
  await bob.disconnect();
});
