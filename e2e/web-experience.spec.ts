import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { numericConversationPath } from "../src/application/conversationPaths";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

async function go(page: Page, href: string) {
  await page.evaluate((target) => {
    const a = document.createElement("a");
    a.href = target;
    document.body.append(a);
    a.click();
    a.remove();
  }, href);
  await expect(page).toHaveURL(href);
}

test.use({ actionTimeout: 12_000 });

test.beforeEach(async ({ context, request }) => {
  const { features } = await (await request.get("/v1/server-info")).json();
  test.skip(!features.includes("saved-collections") || !features.includes("spark-assistant"), "Run with the web experience API patch");
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

test("organizes saved messages, resumes activity, searches, and clears browser history", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const alice = await newPhone("experience", "Asha Patel");
  const bob = await newPhone("experiencepeer", "Nila Roy");
  const conversationId = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id as string;
  const conversationPath = numericConversationPath("dms", conversationId);
  const messageId = randomUUID();
  await alice.send(conversationId, { type: "text", text: "Review the release checklist" }, "message", messageId);
  const personal = await alice.req("GET", "/v1/me/preferences/personal");
  await alice.req("PUT", "/v1/me/preferences/personal", {
    baseRev: personal.rev,
    prefs: { saved: [{ conversationId, messageId, savedAt: Date.now() }] },
  });
  await link(page, alice);
  await go(page, "/activity");
  await page.getByRole("button", { name: "Turn on activity history" }).click();
  await go(page, conversationPath);
  await expect(page.getByRole("log", { name: "Messages" })).toContainText("Review the release checklist");
  await go(page, "/activity");
  await page
    .getByRole("button", { name: /Nila Roy/ })
    .filter({ has: page.locator("time") })
    .click();
  await expect(page).toHaveURL(conversationPath);
  await go(page, "/later");
  await page.getByRole("button", { name: "New collection" }).click();
  await page.getByLabel("Collection name").fill("Release");
  await page.getByRole("dialog").getByRole("button", { name: "Save", exact: true }).click();
  const membership = page.getByLabel("Organize in collections");
  await membership.selectOption({ label: "Add to Release" });
  await expect(membership.locator("option", { hasText: "Remove from Release" })).toHaveCount(1);
  await page.getByRole("combobox", { name: "Collections", exact: true }).selectOption({ label: "Release" });
  await page.getByLabel("Search saved messages").fill("checklist");
  await expect(page.getByRole("button", { name: /Review the release checklist/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Collections", exact: true }).locator("option", { hasText: "Release" })).toHaveCount(1);
  await expect(page.getByLabel("Organize in collections").locator("option", { hasText: "Remove from Release" })).toHaveCount(1);
  await page.screenshot({ path: info.outputPath("saved.png") });

  await go(page, "/discover");
  await page.locator(".discover-head").getByRole("button", { name: "Search Meldiq" }).click();
  const search = page.getByRole("combobox", { name: "Search", exact: true });
  await expect(search).toBeFocused();
  const request = page.waitForRequest((req) => req.method() === "POST" && req.url().endsWith("/v2/search"));
  await search.fill("Nila");
  expect((await request).postDataJSON()).toMatchObject({ q: "Nila" });
  await expect(page.getByRole("option", { name: /Nila Roy/ }).first()).toBeVisible();
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(page.getByRole("dialog", { name: "Search", exact: true })).toHaveCount(0);
  await go(page, "/settings/security");
  await page.getByRole("button", { name: "Clear recent searches" }).click();
  await expect(page.getByRole("button", { name: "Clear recent searches" })).toBeDisabled();
  await page.getByRole("button", { name: "Clear activity history" }).click();
  await expect(page.getByRole("button", { name: "Clear activity history" })).toBeDisabled();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});

test("uses Spark, submits feedback, and keeps Bengali after reload", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const alice = await newPhone("trust", "Trust Test");
  await link(page, alice);
  await go(page, "/settings/security");
  await page.getByRole("button", { name: "Manage Spark history" }).click();
  const spark = page.getByRole("dialog", { name: "Meldiq Spark Assistant" });
  const prompt = spark.getByRole("textbox", { name: "Message for Spark" });
  if (process.env.MELDIQ_E2E_SPARK_FIXTURE === "1") {
    await prompt.fill("Help me find a saved message");
    const send = spark.getByRole("button", { name: "Send to Spark" });
    await expect(send).toBeDisabled();
    await spark.getByRole("checkbox", { name: /I agree to send/ }).check();
    await send.click();
    await expect(spark.getByText("Staging Spark stream verified")).toBeVisible();
    await spark.getByRole("button", { name: "Rename", exact: true }).click();
    await spark.getByRole("textbox", { name: "Conversation title" }).fill("Staging history");
    await spark.getByRole("button", { name: "Save", exact: true }).click();
    await expect(spark.getByRole("option", { name: /Staging history/ })).toHaveCount(1);
    await page.reload();
    await page.getByRole("button", { name: "Manage Spark history" }).click();
    const history = spark.getByRole("combobox", { name: "Conversation history" });
    const option = history.getByRole("option", { name: /Staging history/ });
    await expect(option).toHaveCount(1);
    await history.selectOption(await option.getAttribute("value") ?? "");
    await expect(spark.getByText("Staging Spark stream verified")).toBeVisible();
    await spark.getByRole("button", { name: "Delete conversation" }).click();
    await spark.getByRole("button", { name: "Delete conversation" }).last().click();
    await expect(option).toHaveCount(0);
  } else {
    await expect(spark.getByText(/Spark is unavailable on this server/)).toBeVisible();
    await expect(prompt).toHaveCount(0);
  }
  await page.keyboard.press("Escape");
  await expect(spark).toHaveCount(0);
  await go(page, "/settings/about");
  await page.getByRole("button", { name: "Send feedback" }).click();
  const feedback = page.getByRole("dialog", { name: "Send feedback" });
  await feedback.getByLabel("Category").selectOption("feature");
  await feedback.getByLabel("Short title").fill("Pin my favorite collection");
  await feedback.getByLabel("What would you like us to know?").fill("A pinned collection would make finding saved messages faster.");
  await feedback.getByRole("button", { name: "Send feedback" }).click();
  await expect(page.getByText("Thanks. Your submission is in your feedback history.")).toBeVisible();
  await expect(page.getByRole("list", { name: "Your feedback history" })).toContainText("Pin my favorite collection");
  await go(page, "/settings/language");
  await page.locator("button.lang-picker").first().click();
  await page.getByRole("option", { name: "বাংলা", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
  await go(page, "/settings/security");
  await page.reload();
  await expect(page.getByRole("heading", { name: "ইতিহাস ও ব্যক্তিগত পছন্দ" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath("privacy-bn.png") });
  if (info.project.name === "chromium") {
    await page.setViewportSize({ width: 900, height: 1000 });
    await expect(page.getByRole("heading", { name: "ইতিহাস ও ব্যক্তিগত পছন্দ" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: info.outputPath("privacy-tablet.png") });
  }
  expect(errors).toEqual([]);
});
