import crypto from "node:crypto";
import { expect, test } from "@playwright/test";
import { emailedCode } from "./mail";
import { testAddress } from "./phone";

test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ context }) => context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() }));

test("real ranking endpoint, all six boards, podium ties, category races and retry", async ({ page, isMobile }, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Create an account", exact: true }).click();
  const email = `rank.${crypto.randomBytes(5).toString("hex")}@example.test`;
  await page.getByLabel("Your name", { exact: true }).fill("Ranking Explorer");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a long enough password");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByLabel("Code", { exact: true }).fill(await emailedCode(email, "verify"));
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("button", { name: "Set up encryption", exact: true }).click();
  await page.getByLabel("I've stored my recovery key somewhere safe.").check();
  await page.getByRole("button", { name: "Open Meldiq", exact: true }).click();
  await expect(page.locator(".app[data-connection=online]").first()).toBeVisible({ timeout: 20000 });
  await page.goto("/settings/leaderboards");
  await expect(page.getByRole("heading", { name: "Leaderboards", exact: true })).toBeVisible();
  for (const label of ["Level", "Messages", "Voice", "Embers", "Gifts", "Invites"]) {
    await page.getByRole("tab", { name: label, exact: true }).click();
    await expect(page.getByRole("tabpanel")).toHaveAttribute("aria-busy", "false");
    await expect(page.getByRole("alert")).toHaveCount(0);
  }
  // UI fixtures exercise populated layouts and request ordering; the first six requests above hit the real API.
  let fail = false;
  await page.route("**/v2/leaderboards?*", async (route) => {
    const metric = new URL(route.request().url()).searchParams.get("metric")!;
    if (fail) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "unavailable", message: "Rankings are taking a moment. Please retry." } }) });
    if (metric === "messages") await new Promise((resolve) => setTimeout(resolve, 500));
    const names = ["Moonlit Explorer With A Very Long Name", "River", "Ember", "Willow", "Noor"];
    const entries = names.map((displayName, i) => ({
      rank: i < 2 ? 1 : i + 1,
      value: metric === "level" ? 20 - (i < 2 ? 0 : i) : 1000 - (i < 2 ? 0 : i * 100),
      user: { id: `fixture-${i}`, username: `explorer_${i}`, displayName, avatarColor: i, photoRev: null, avatarMedia: null, decoration: i === 0 ? "aurora" : null },
    }));
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        metric,
        period: metric === "messages" || metric === "voice" ? "week" : "all",
        scope: metric === "messages" || metric === "voice" ? "visible_communities" : "meldiq",
        generatedAt: Date.now(),
        total: 101,
        entries,
        me: { ...entries[4], rank: 101, value: 5 },
      }),
    });
  });
  await page.getByRole("tab", { name: "Level", exact: true }).click();
  await expect(page.locator(".podium-person")).toHaveCount(3);
  await expect(page.locator(".rank-medal[aria-label='Rank 1']")).toHaveCount(2);
  await expect(page.getByLabel("Your ranking")).toContainText("#101 of 101");
  expect(await page.locator(".settings-page").evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: `/tmp/meldiq-leaderboards-${info.project.name}.png` });
  await page.getByRole("tab", { name: "Level", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Messages", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Voice", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".podium-value").first()).toContainText("minutes");
  await page.waitForTimeout(650);
  await expect(page.locator(".podium-value").first()).toContainText("minutes");
  fail = true;
  await page.getByRole("button", { name: "Refresh rankings" }).click();
  await expect(page.getByRole("alert")).toContainText("Rankings are taking a moment");
  fail = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator(".podium-person")).toHaveCount(3);
  if (!isMobile) {
    const nav = page.getByRole("navigation", { name: "Settings pages" });
    await expect(nav.getByRole("button", { name: "Log out", exact: true })).toBeInViewport();
    await page.getByRole("searchbox", { name: "Search settings" }).fill("trophy");
    await expect(nav.getByRole("button", { name: /Leaderboards/ })).toBeVisible();
    await page.getByRole("searchbox", { name: "Search settings" }).press("Escape");
  }
  expect(errors).toEqual([]);
});
