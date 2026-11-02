import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

test.beforeEach(async ({ context }) => context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() }));

test("community messages omit receipts while DMs retain them; expressions share a compact grouped picker", async ({ page }, info) => {
  const alice = await newPhone("communityui", "Community Tester");
  const bob = await newPhone("communitypeer", "Community Peer");
  const { org } = await alice.req("POST", "/v1/orgs", { name: "Meldiq Design Lab" });
  const { channel } = await alice.req("POST", `/v1/orgs/${org.id}/channels`, { name: "expression-room", scope: "ORG", kind: "PUBLIC" });
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
  await alice.req("POST", `/v1/orgs/${org.id}/expressions?kind=emoji&name=brand_wave`, undefined, png);
  await alice.req("POST", `/v1/orgs/${org.id}/expressions?kind=sticker&name=brand_hello`, undefined, png);
  await link(page, alice);
  await page
    .locator(".sidebar")
    .getByRole("link", { name: /expression-room/ })
    .click();
  const composer = page.getByRole("textbox", { name: /Message/ });
  await composer.fill("Community status check");
  await composer.press("Enter");
  const message = page.getByRole("article").filter({ hasText: "Community status check" });
  await expect(message).toBeVisible();
  await expect(message.locator('[aria-label="Sending"]')).toHaveCount(0);
  await expect(message.locator('[aria-label="Sent"], [aria-label="Delivered"], [aria-label="Read"]')).toHaveCount(0);
  expect(channel.id).toBeTruthy();
  await page.getByRole("button", { name: "Insert emoji" }).click();
  const picker = page.getByRole("dialog", { name: "Expressions", exact: true });
  await expect(picker.getByRole("searchbox")).toHaveCount(1);
  await expect(picker.getByRole("tab", { name: /^(GIFs|Stickers)$/ })).toHaveCount(0);
  const group = picker.getByRole("region", { name: "Meldiq Design Lab", exact: true });
  await expect(group.getByRole("button", { name: ":brand_wave:", exact: true })).toBeVisible();
  await expect(group.getByRole("button", { name: "Send sticker :brand_hello:", exact: true })).toBeVisible();
  await page.screenshot({ path: `/tmp/meldiq-unified-expressions-${info.project.name}.png` });
  await picker.getByRole("searchbox").fill("brand wave");
  await group.getByRole("button", { name: ":brand_wave:", exact: true }).click();
  await group.getByRole("button", { name: ":brand_wave:", exact: true }).click();
  await expect(composer).toHaveValue(":brand_wave: :brand_wave: ");
  await picker.getByRole("button", { name: "Close expression picker" }).click();
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id;
  await page.goto(`/dms/c/${dm}`);
  await composer.fill("DM status check");
  await composer.press("Enter");
  await expect(page.getByRole("article").filter({ hasText: "DM status check" }).locator('[aria-label="Sent"], [aria-label="Delivered"], [aria-label="Read"]')).toHaveCount(1);
});
