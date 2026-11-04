import path from "node:path";
import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ context }) => context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() }));

test("message search distinguishes failure from no matches and retries the same query", async ({ page }) => {
  const alice = await newPhone("searchretry", "Alice Search");
  const bob = await newPhone("searchpeer", "Bob Search");
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id;
  await bob.send(dm, { type: "text", text: "Needle from the history service" });
  await link(page, alice);
  await page.goto(`/dms/c/${dm}`);
  await expect(page.getByRole("log", { name: "Messages" })).toHaveAttribute("aria-busy", "false");
  await page.goto(`/dms/c/${dm}/search`);
  const panel = page.getByRole("complementary", { name: "Search in this conversation" });
  const input = panel.getByRole("textbox", { name: "Search in this conversation" });
  let failed = true;
  await page.route("**/v2/messages/search?**", async (route) => {
    if (failed) await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "unavailable", message: "Search fixture unavailable" } }) });
    else await route.continue();
  });
  await input.fill("Needle");
  await expect(panel.getByRole("alert")).toContainText(/Couldn.t load messages/);
  await expect(input).toHaveValue("Needle");
  await expect(panel.getByText(/No messages here match/)).toHaveCount(0);
  failed = false;
  await panel.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(panel.getByRole("alert")).toHaveCount(0);
  await expect(panel.getByRole("button", { name: /Needle from the history service/ })).toBeVisible();
  if (process.env.ORBIT_E2E_SHOTS) await page.screenshot({ path: path.join(process.env.ORBIT_E2E_SHOTS, `search-${page.viewportSize()?.width}.png`) });
  await input.fill("NoSuchMessageInThisFixture");
  await expect(panel.getByText(/No messages here match/)).toBeVisible();
  await expect(panel.getByRole("alert")).toHaveCount(0);
});
