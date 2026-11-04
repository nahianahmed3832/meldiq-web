import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";
test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ context }) => context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() }));

test("request notes stay recipient-only, retain drafts after failure and disappear after acceptance", async ({ page, browser, baseURL }) => {
  const alice = await newPhone("notealice", "Alice Note"),
    bob = await newPhone("notebob", "Bob Note");
  await link(page, alice);
  await page.goto("/friends");
  await page.getByRole("tab", { name: "Add Friend", exact: true }).click();
  const form = page.locator("form.add-friend");
  await form.getByRole("textbox", { name: "Username", exact: true }).fill(bob.username);
  const note = "A private invitation with <b>literal text</b> 😀";
  await form.getByRole("textbox", { name: "Note (optional)", exact: true }).fill(note);
  let fail = true;
  await page.route("**/v1/connections", async (route) => {
    if (fail && route.request().method() === "POST")
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "unavailable", message: "Fixture request outage" } }) });
    else await route.continue();
  });
  await form.getByRole("button", { name: "Send Friend Request" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(form.getByRole("textbox", { name: "Username", exact: true })).toHaveValue(bob.username);
  await expect(form.getByRole("textbox", { name: "Note (optional)", exact: true })).toHaveValue(note);
  fail = false;
  await form.getByRole("button", { name: "Send Friend Request" }).click();
  await expect.poll(async () => (await bob.req("GET", "/v1/connections")).incoming[0]?.note).toBe(note);
  await page.getByRole("tab", { name: /^Pending/ }).click();
  await expect(page.getByText(note, { exact: true })).toHaveCount(0);
  const otherContext = await browser.newContext({
    baseURL,
    viewport: page.viewportSize(),
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: "meldiq.introSeen", value: "1" }] }] },
    serviceWorkers: "block",
  });
  try {
    await otherContext.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
    const recipient = await otherContext.newPage();
    await link(recipient, bob);
    await recipient.goto("/friends");
    await recipient.getByRole("tab", { name: /^Pending/ }).click();
    await expect(recipient.getByText(note, { exact: true })).toBeVisible();
    await expect(recipient.locator(".friend-row b")).toHaveCount(0);
    await recipient.getByRole("button", { name: "Accept Alice Note", exact: true }).click();
    await expect(recipient.getByText(note, { exact: true })).toHaveCount(0);
    await expect.poll(async () => (await alice.req("GET", "/v1/connections")).connected.map((u: any) => u.id)).toEqual([bob.userId]);
  } finally {
    await otherContext.close();
  }
});

test("three-to-five quick reactions persist on the account and drive the message menu", async ({ page }) => {
  const alice = await newPhone("quickalice", "Alice Quick"),
    bob = await newPhone("quickbob", "Bob Quick");
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id;
  await bob.send(dm, { type: "text", text: "A reaction fixture" });
  await link(page, alice);
  await page.goto("/settings/appearance");
  const group = page.getByRole("group", { name: "Quick reactions", exact: true });
  for (const emoji of ["👀", "🎉", "😂"]) await group.getByRole("button", { name: `React with ${emoji}`, exact: true }).click();
  await expect(group.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  await group.getByRole("button", { name: "React with ✅", exact: true }).click();
  await group.getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(async () => (await alice.req("GET", "/v1/me/preferences/personal")).prefs.quickReactions).toEqual(["👍", "❤️", "✅"]);
  await page.reload();
  await expect(group.getByRole("button", { name: "React with ✅", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(group.getByRole("button", { name: "React with 😂", exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.goto(`/dms/c/${dm}`);
  const message = page.locator(".msg").filter({ hasText: "A reaction fixture" });
  await message.click({ button: "right" });
  const menu = page.getByRole("menu");
  const reactions = menu.getByRole("group", { name: "Quick reactions", exact: true });
  await expect(reactions.getByRole("button", { name: /^React / })).toHaveCount(3);
  await expect(reactions.getByRole("button", { name: "Add reaction", exact: true })).toBeVisible();
  await reactions.getByRole("button", { name: "React ✅", exact: true }).click();
  await expect(message.getByRole("button", { name: "✅ 1, reacted by You", exact: true })).toBeVisible();
});
