import path from "node:path";
import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

/**
 * Profile decorations (API 0.60.0, server docs/PROFILE_DECORATIONS.md): Meldiq's own are picked in Settings › Profile
 * and drawn over the avatar; your own is sent in from "Make your own" and waits for review under "Yours".
 */
test.skip(({ browserName }) => browserName !== "chromium", "one engine is enough for the decoration picker");
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

const loaded = (els: Element[]) => els.length > 0 && els.every((e) => (e as HTMLImageElement).complete && (e as HTMLImageElement).naturalWidth > 0);

test("wear one of Meldiq's decorations, and send your own in for review", async ({ page }) => {
  const alice = await newPhone("alice", "Alice Rahman");
  const info = await alice.req("GET", "/v1/server-info");
  test.skip(!(info.features as string[]).includes("profile-decorations"), `the server (${info.version}) has no profile decorations (API 0.60.0)`);
  await link(page, alice);
  await page.goto("/settings/profile");

  const own = page.getByRole("group", { name: "Meldiq's decorations" });
  await own.getByRole("button", { name: "Flames", exact: true }).click();
  await expect(own.getByRole("button", { name: "Flames", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await alice.req("GET", "/v1/users/me")).user.profileStyle?.decoration).toBe("flames");
  await expect.poll(() => page.locator(".style-preview .deco-img").evaluateAll(loaded), { message: "the decoration over the preview avatar" }).toBe(true);
  await page.locator(".style-preview").screenshot({ path: test.info().outputPath("preview.png") });
  await own.screenshot({ path: test.info().outputPath("meldiq-tab.png") });

  // A classic frame still works, and None takes it off.
  await own.getByRole("button", { name: "Aurora", exact: true }).click();
  await expect(page.locator(".style-preview .deco-aurora")).toBeVisible();
  await own.getByRole("button", { name: "None", exact: true }).click();
  await expect.poll(async () => (await alice.req("GET", "/v1/users/me")).user.profileStyle?.decoration ?? null).toBeNull();

  await page.getByRole("button", { name: "Make your own" }).click();
  const dialog = page.getByRole("dialog", { name: "Make a decoration" });
  await expect(dialog.getByRole("link", { name: "Get the template" })).toHaveAttribute("href", /\/v2\/decorations\/template$/);
  const send = dialog.getByRole("button", { name: "Send it in" });
  await dialog.locator("input[type=file]").setInputFiles(path.join(import.meta.dirname, "fixtures/decoration.png"));
  await dialog.getByPlaceholder("Name it").fill("Violet ring");
  await expect(send).toBeDisabled();
  await dialog.getByRole("checkbox").check();
  await expect.poll(() => dialog.locator(".deco-make-preview .deco-img").evaluateAll(loaded)).toBe(true);
  await dialog.screenshot({ path: test.info().outputPath("make.png") });
  await send.click();
  await expect(dialog).toBeHidden();

  const mine = page.locator(".deco-submission").filter({ hasText: "Violet ring" });
  await expect(mine).toContainText("Waiting for review");
  await expect(page.getByText("1 of 3 waiting for review.")).toBeVisible();
  await page.locator(".deco-picker").screenshot({ path: test.info().outputPath("yours.png") });
  const submissions = (await alice.req("GET", "/v2/decorations/mine")).submissions;
  expect(submissions).toEqual([expect.objectContaining({ name: "Violet ring", status: "pending" })]);
});
