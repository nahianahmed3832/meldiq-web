import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";
test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
});
test("Markdown stays escaped, masked links show their destination, and failed edits/deletions preserve content and drafts", async ({ page }) => {
  const alice = await newPhone("actionsalice", "Action Alice"),
    bob = await newPhone("actionsbob", "Action Bob");
  const cid = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id;
  const id = `m_actions_${Date.now()}`,
    raw = "**Bold fixture** and *italic fixture* `code fixture`\n[Safe label](https://example.com/path)\n[Unsafe label](javascript:alert(1))\n<img src=x onerror=alert(1)>";
  await alice.send(cid, { type: "text", text: raw }, "message", id);
  await bob.send(cid, { type: "text", text: "Neighbor private content" });
  await link(page, alice);
  await page.goto(`/dms/c/${cid}`);
  const m = page.locator(`#msg-${id}`);
  await expect(m.locator(".msg-text strong")).toHaveText("Bold fixture");
  await expect(m.locator(".msg-text em")).toHaveText("italic fixture");
  await expect(m.locator(".msg-text code")).toHaveText("code fixture");
  await expect(m.locator(".msg-text img,.msg-text script")).toHaveCount(0);
  await expect(m.locator('a[href^="javascript:"]')).toHaveCount(0);
  await m.getByRole("link", { name: "Safe label", exact: true }).click();
  const linkDialog = page.getByRole("dialog", { name: "example.com", exact: true });
  await expect(linkDialog.locator(".link-full")).toHaveText("https://example.com/path");
  await linkDialog.getByRole("button", { name: "Close", exact: true }).click();
  await page.reload();
  await expect(m.locator(".msg-text strong")).toHaveText("Bold fixture");
  await m.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Copy text", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(raw);
  let failEdit = true,
    failDelete = true;
  await page.route("**/v2/messages", async (route) => {
    const payload = route.request().postDataJSON()?.payload;
    if (payload?.type === "edit" && failEdit) {
      failEdit = false;
      return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "unavailable", message: "Fixture edit outage" } }) });
    }
    if (payload?.type === "delete" && failDelete) {
      failDelete = false;
      return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "unavailable", message: "Fixture deletion outage" } }) });
    }
    await route.continue();
  });
  await m.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Edit message", exact: true }).click();
  const edit = m.getByRole("textbox", { name: "Edit message", exact: true });
  await edit.fill("**Confirmed edit**");
  await m.getByRole("button", { name: "Save", exact: true }).click();
  await expect(m.getByRole("alert")).toContainText("Fixture edit outage");
  await expect(edit).toHaveValue("**Confirmed edit**");
  expect((await bob.req("GET", `/v2/conversations/${cid}/messages`)).messages.find((v: any) => v.id === id).payload.text).toBe(raw);
  await m.getByRole("button", { name: "Save", exact: true }).click();
  await expect(edit).toHaveCount(0);
  await expect(m.locator(".msg-text strong")).toHaveText("Confirmed edit");
  await page.reload();
  await expect(m.locator(".msg-text strong")).toHaveText("Confirmed edit");
  await expect(m.locator(".msg-meta").filter({ hasText: "(edited)" })).toContainText("edited");
  await m.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete for everyone", exact: true }).click();
  const del = page.getByRole("dialog", { name: "Delete this message for everyone?", exact: true });
  await del.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(del.getByRole("alert")).toContainText("Fixture deletion outage");
  await expect(m.locator(".msg-text strong")).toHaveText("Confirmed edit");
  await del.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(del).toHaveCount(0);
  await expect(m.locator(".msg-deleted")).toBeVisible();
});
test("long messages expand and collapse with keyboard focus retained while Copy text keeps the complete message", async ({ page }) => {
  const alice = await newPhone("longalice", "Long Alice"),
    bob = await newPhone("longbob", "Long Bob");
  const cid = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id;
  const id = `m_long_${Date.now()}`,
    raw = Array.from({ length: 30 }, (_, i) => `Line ${i + 1}: original text`).join("\n");
  await bob.send(cid, { type: "text", text: raw }, "message", id);
  for (let i = 0; i < 12; i++) await bob.send(cid, { type: "text", text: `Later boundary ${i}` });
  await link(page, alice);
  await page.goto(`/dms/c/${cid}`);
  const m = page.locator(`#msg-${id}`),
    more = m.getByRole("button", { name: "Show more", exact: true });
  await expect(m).not.toContainText("Line 30:");
  await m.scrollIntoViewIfNeeded();
  await more.focus();
  const before = (await m.boundingBox())!.y;
  await page.keyboard.press("Enter");
  const less = m.getByRole("button", { name: "Show less", exact: true });
  await expect(less).toBeFocused();
  await expect(less).toHaveAttribute("aria-expanded", "true");
  await expect(m).toContainText("Line 30:");
  await expect.poll(async () => Math.abs((await m.boundingBox())!.y - before)).toBeLessThan(4);
  await page.keyboard.press("Enter");
  await expect(more).toBeFocused();
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await m.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Copy text", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(raw);
});

test("colon emoji completion is keyboard accessible and choosing an option never submits the draft", async ({ page }) => {
  const alice = await newPhone("colonAlice", "Colon Alice"),
    bob = await newPhone("colonBob", "Colon Bob");
  const cid = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id;
  await link(page, alice);
  await page.goto(`/dms/c/${cid}`);
  const input = page.locator(".composer textarea");
  await input.fill(":thumbs_up");
  const options = page.getByRole("listbox", { name: /^emoji$/i });
  await expect(options.getByRole("option").first()).toBeVisible();
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(options).toHaveCount(0);
  await expect(input).not.toHaveValue(":thumbs_up");
  expect((await alice.req("GET", `/v2/conversations/${cid}/messages`)).messages).toHaveLength(0);
  await input.fill(":smile");
  await expect(options).toBeVisible();
  await input.press("Escape");
  await expect(options).toHaveCount(0);
  await expect(input).toHaveValue(":smile");
});
