import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

test.skip(({ isMobile }) => isMobile, "The phone layout deliberately hides the desktop DM rail; phone checkout and popup have their own coverage.");

test.beforeEach(async ({ context }) => context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() }));
test("unread badges paint over avatar decorations in the rail", async ({ page }, info) => {
  const alice = await newPhone("railbadge", "Rail Tester"),
    bob = await newPhone("railpeer", "Decorated Friend");
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id;
  await bob.req("PUT", "/v1/users/me/profile-style", { decoration: "flames" });
  await bob.req("PUT", "/v1/users/me/photo", undefined, fs.readFileSync(path.join(import.meta.dirname, "fixtures/photo.jpg")));
  await bob.connect();
  await link(page, alice);
  await page.goto("/dms");
  await expect(page.locator(".app[data-connection=online]").first()).toBeVisible();
  await bob.send(dm, { type: "text", text: "Unread with a frame" });
  const tile = page.locator(".rail-dm").filter({ has: page.locator(".count") });
  await expect(tile).toHaveCount(1);
  await expect(tile.locator(".deco-img")).toBeVisible();
  await expect(tile.locator(".count")).toHaveText("1");
  const visible = await tile.locator(".count").evaluate((el) => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width * 0.4,
      y = r.top + r.height * 0.4;
    return document
      .elementsFromPoint(x, y)
      .filter((e) => e.matches(".count,.deco-img,.deco"))
      .map((e) => e.className)[0]
      ?.includes("count");
  });
  expect(visible).toBe(true);
  await page.locator(".rail").screenshot({ path: info.outputPath("rail-badges.png") });
});
