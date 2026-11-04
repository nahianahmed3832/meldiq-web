import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";
test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ context }) => context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() }));
test("offline sends and a lost HTTP acknowledgement recover without duplicate messages or lost drafts", async ({ page, context }) => {
  const alice = await newPhone("retryalice", "Retry Alice"),
    bob = await newPhone("retrybob", "Retry Bob");
  const cid = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id;
  await bob.connect();
  try {
    await link(page, alice);
    await page.goto(`/dms/c/${cid}`);
    const composer = page.getByRole("textbox", { name: "Message Retry Bob", exact: true });
    await expect(composer).toBeVisible();
    await context.setOffline(true);
    await composer.fill("Queued while offline");
    await composer.press("Enter");
    await expect(page.locator(".msg").filter({ hasText: "Queued while offline" })).toHaveCount(1);
    await expect(composer).toHaveValue("");
    await context.setOffline(false);
    await expect.poll(() => bob.received.filter((m) => m.payload.text === "Queued while offline").length, { timeout: 30000 }).toBe(1);
    let intercepted = false;
    await page.route("**/v2/messages", async (route) => {
      if (route.request().method() !== "POST" || intercepted) {
        await route.continue();
        return;
      }
      intercepted = true;
      const accepted = await route.fetch();
      expect(accepted.ok()).toBe(true);
      // The real API accepted it, but the browser receives an outage instead of the acknowledgement.
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "unavailable", message: "Fixture lost acknowledgement" } }) });
    });
    await composer.fill("Accepted once despite a lost acknowledgement");
    await composer.press("Enter");
    await expect.poll(() => intercepted).toBe(true);
    await expect.poll(() => bob.received.filter((m) => m.payload.text === "Accepted once despite a lost acknowledgement").length, { timeout: 30000 }).toBe(1);
    await page.reload();
    for (const text of ["Queued while offline", "Accepted once despite a lost acknowledgement"]) {
      await expect(page.locator(".msg").filter({ hasText: text })).toHaveCount(1);
      const rows = (await bob.req("GET", `/v2/conversations/${cid}/messages`)).messages;
      expect(rows.filter((m: any) => m.payload?.text === text)).toHaveLength(1);
    }
  } finally {
    await context.setOffline(false);
    await bob.disconnect();
  }
});
