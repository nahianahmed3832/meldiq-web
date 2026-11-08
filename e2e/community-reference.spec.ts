import path from "node:path";
import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ context }) => context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() }));

test("community settings save through the existing API and show the quoted offers", async ({ page, isMobile, browserName }) => {
  test.skip(isMobile || !["chromium", "webkit"].includes(browserName), "desktop settings window");
  const owner = await newPhone("communityref", "Community Reference Owner");
  const { org } = await owner.req("POST", "/v1/orgs", { name: "Reference Room" });
  const shots = process.env.ORBIT_E2E_SHOTS;
  const screenshot = async (name: string) => {
    if (shots && browserName === "chromium") await page.screenshot({ path: path.join(shots, name + ".png"), animations: "disabled" });
  };
  await link(page, owner);
  await page.goto("/workspace/overview");
  const settings = page.getByRole("dialog", { name: "Reference Room settings" });
  const rail = settings.getByRole("navigation", { name: "Community settings" });
  await expect(settings.getByRole("heading", { name: "Server profile" })).toBeVisible();
  await expect(settings.getByRole("complementary", { name: "Server profile preview" })).toContainText("Reference Room");
  await screenshot("overview");

  const { features } = await owner.req("GET", "/v1/server-info");
  if (features.includes("community-voice-clips")) {
    const clips = settings.getByRole("switch", { name: "Allow clips in voice channels" });
    await expect(clips).not.toBeChecked();
    await clips.click();
    await expect(clips).toBeChecked();
    await expect.poll(() => owner.req("GET", `/v1/orgs/${org.id}/settings`)).toMatchObject({ voiceClips: true });
  }

  await rail.getByRole("button", { name: "Theme", exact: true }).click();
  await settings.getByRole("textbox", { name: "Accent color as hexadecimal" }).fill("#8458e8");
  await settings.getByRole("textbox", { name: "Background tint as hexadecimal" }).fill("#14b8a6");
  await screenshot("theme");
  await settings.getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(() => owner.req("GET", `/v1/orgs/${org.id}/settings`)).toMatchObject({ accent: "#8458e8", background: "#14b8a6" });
  await expect(settings.getByRole("button", { name: "Save", exact: true })).toBeDisabled();

  await rail.getByRole("button", { name: "Channels", exact: true }).click();
  const arranger = settings.getByRole("region", { name: "Arrange channels" });
  await expect(arranger).toBeVisible();
  for (const name of ["First category", "Second category"]) {
    await arranger.getByRole("button", { name: "Create category" }).click();
    const create = page.getByRole("dialog", { name: "Create category" });
    await create.getByRole("textbox", { name: "Category name" }).fill(name);
    await create.getByRole("button", { name: "Create category" }).click();
    await expect(create).toBeHidden();
    await expect(arranger.getByText(name, { exact: true })).toBeVisible();
  }
  await arranger.getByRole("button", { name: "Move Second category up" }).click();
  const names = () => arranger.locator(".ws-order-section strong").allTextContents();
  await expect.poll(async () => (await names()).slice(-2)).toEqual(["Second category", "First category"]);
  await arranger.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await names()).slice(-2)).toEqual(["First category", "Second category"]);
  await screenshot("channels");

  await rail.getByRole("button", { name: "Emoji", exact: true }).click();
  await expect(settings.getByRole("heading", { name: "No emojis yet" })).toBeVisible();
  await expect(settings.getByText("0 / 50 used")).toBeVisible();
  await screenshot("emoji");
  await rail.getByRole("button", { name: "Stickers", exact: true }).click();
  await expect(settings.getByRole("heading", { name: "No stickers yet" })).toBeVisible();

  if (features.includes("community-ping-roles")) {
    await rail.getByRole("button", { name: "Ping roles", exact: true }).click();
    const editor = settings.getByRole("region", { name: "Manage ping roles", exact: true });
    await editor.getByRole("button", { name: "Add a ping role" }).click();
    await editor.getByRole("textbox", { name: "Name for ping role 1" }).fill("Release news");
    await editor.getByRole("button", { name: "Save", exact: true }).click();
    const choices = settings.getByRole("region", { name: "Your ping roles", exact: true });
    await choices.getByRole("checkbox", { name: "Release news" }).check();
    await choices.getByRole("button", { name: "Save", exact: true }).click();
    await expect.poll(async () => (await owner.req("GET", `/v1/orgs/${org.id}/ping-roles`)).subscribed.length).toBe(1);
    await page.reload();
    await expect(choices.getByRole("checkbox", { name: "Release news" })).toBeChecked();
    await screenshot("ping-roles");
  }

  await rail.getByRole("button", { name: "Supercharge", exact: true }).click();
  await expect(settings.getByText("$5.98/month", { exact: true })).toBeVisible();
  await settings.getByRole("button", { name: /Level 2/ }).click();
  await expect(settings.getByText("$20.93/month", { exact: true })).toBeVisible();
  await settings.getByRole("button", { name: /Level 3/ }).click();
  await expect(settings.getByText("$41.86/month", { exact: true })).toBeVisible();
  await expect(settings.getByRole("button", { name: /Get Supercharge/ })).toBeDisabled();
  await screenshot("supercharge");
  await rail.getByRole("button", { name: "Promote", exact: true }).click();
  await expect(settings.locator(".promote-price")).toHaveText([/\$3\.99/, /\$7\.99/, /\$12\.99/, /\$29\.99/]);
  await expect(settings.getByRole("button", { name: "Get Mega Boost", exact: true })).toBeDisabled();
  await screenshot("promote");

  await settings.getByRole("button", { name: "Close settings" }).click();
  await expect(settings).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/workspace/sparks");
  await expect(page.getByRole("heading", { name: "Supercharge Reference Room" })).toBeVisible();
  const dimensions = await page.locator(".community-supercharge").evaluate((node) => ({ client: node.clientWidth, content: node.scrollWidth }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.client);
  await screenshot("supercharge-phone");
});

test("voice clips require participant consent and reach the associated room chat", async ({ page, browser, baseURL, browserName, isMobile }) => {
  test.skip(browserName !== "chromium" || isMobile || !process.env.ORBIT_E2E_LIVEKIT, "desktop Chromium with LiveKit and synthetic audio");
  const owner = await newPhone("clipowner", "Clip Owner");
  const member = await newPhone("clipmember", "Clip Member");
  const { features } = await owner.req("GET", "/v1/server-info");
  test.skip(!features.includes("community-voice-clips"), "the clip API is not available");
  const { org } = await owner.req("POST", "/v1/orgs", { name: "Voice clip fixture" });
  const { invite } = await owner.req("POST", `/v1/orgs/${org.id}/invites`, { role: "MEMBER" });
  await member.req("POST", "/v1/invites/accept", { code: invite.code });
  await owner.req("PUT", `/v1/orgs/${org.id}/settings`, { voiceClips: true });
  const { channel } = await owner.req("POST", `/v1/orgs/${org.id}/channels`, { name: "clips-qa", voice: true, scope: "ORG" });
  const guest = await browser.newContext({
    baseURL,
    permissions: ["microphone"],
    serviceWorkers: "block",
    extraHTTPHeaders: { "x-orbit-test-ip": testAddress() },
  });
  try {
    const remote = await guest.newPage();
    await remote.addInitScript(() => localStorage.setItem("meldiq.introSeen", "1"));
    await link(page, owner);
    await link(remote, member);
    for (const client of [page, remote]) {
      await client.goto(`/home/c/${channel.id}`);
      await client.getByRole("button", { name: "Join voice", exact: true }).click();
      await client.getByRole("button", { name: "Voice clips", exact: true }).click();
    }
    const dialog = page.getByRole("dialog", { name: "Voice clips", exact: true });
    const remoteDialog = remote.getByRole("dialog", { name: "Voice clips", exact: true });
    const capture = dialog.getByRole("button", { name: "Capture recent clip", exact: true });
    const consent = remoteDialog.getByRole("switch", { name: "Let people clip my audio and screen share", exact: true });
    await dialog.getByRole("button", { name: "Start buffering", exact: true }).click();
    await expect(capture).toBeDisabled();
    await consent.click();
    await expect(consent).toBeChecked();
    await expect(capture).toBeEnabled({ timeout: 20_000 });
    await consent.click();
    await expect(capture).toBeDisabled();
    await consent.click();
    await expect(capture).toBeEnabled();
    await capture.click();
    const audio = dialog.locator("audio");
    await expect(audio).toBeVisible();
    await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.readyState)).toBeGreaterThanOrEqual(1);
    await consent.click();
    await expect(audio).toHaveCount(0);
    await consent.click();
    await expect(capture).toBeEnabled();
    await capture.click();
    await dialog.getByRole("button", { name: "Post to room chat", exact: true }).click();
    await expect(dialog).toBeHidden();
    await page.getByRole("button", { name: "Minimise the call", exact: true }).click();
    const modes = page.getByRole("group", { name: "Room chat", exact: true });
    await modes.getByRole("button", { name: "Room chat", exact: true }).click();
    await expect(page.locator(".msg").filter({ hasText: "meldiq-clip." })).toBeVisible();
  } finally {
    await guest.close();
  }
});
