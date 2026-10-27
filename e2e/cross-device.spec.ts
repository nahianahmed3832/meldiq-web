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

const isPhoneWidth = (page: Page) => (page.viewportSize()?.width ?? 1440) < 640;

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
  await expect(page.locator(":is(.conn.online, .user-panel[data-connection=online]):visible").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Reply typed in the browser ✓")).toBeVisible();

  // Sign out: the server lists the browser as removed, and the browser is back at the link screen.
  await page.goto("/#/settings/security");
  await page.getByRole("button", { name: "Sign out and erase this browser" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sign out" }).click();
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

test("a second tab doesn't take the connection unless asked", async ({ page, context }) => {
  test.skip(isPhoneWidth(page), "desktop behaviour");
  const alice = await newPhone("alice", "Alice Rahman");
  await link(page, alice);
  const second = await context.newPage();
  await second.goto("/");
  await expect(second.getByRole("heading", { name: "Meldiq is open in another tab" })).toBeVisible();
  await second.getByRole("button", { name: "Use Meldiq here" }).click();
  await expect(
    second.locator(":is(.conn.online, .user-panel[data-connection=online]):visible").first(),
    await second
      .locator("body")
      .innerText()
      .catch(() => ""),
  )
    .toBeVisible({ timeout: 15_000 })
    .catch(async (e: Error) => {
      throw new Error(`${e.message}\nSecond tab shows: ${(await second.locator("body").innerText()).slice(0, 400)}`);
    });
  await expect(page.getByRole("heading", { name: "Meldiq is open in another tab" })).toBeVisible();
});
