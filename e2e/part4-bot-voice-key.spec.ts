import { createHash, generateKeyPairSync } from "node:crypto";
import { expect, test } from "@playwright/test";
import { newPhone, testAddress } from "./phone";
import { link } from "./link";

const publicKey = () => generateKeyPairSync("x25519").publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("base64");
test.describe.configure({ timeout: 180_000 });
test.use({ actionTimeout: 15_000 });
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

test("owners configure public voice keys and managers review key changes without changing scopes", async ({ page }, info) => {
  const owner = await newPhone("voicekeyowner", "Voice Key Owner");
  try {
    const { org } = await owner.req("POST", "/v1/orgs", { name: "Bot voice review" });
    const { bot } = await owner.req("POST", "/v2/developer/bots", { name: "Voice Helper", public: true });
    const permissions = ["voice.connect"];
    await owner.req("POST", `/v1/orgs/${org.id}/bots`, { botId: bot.id });
    await owner.req("PUT", `/v2/developer/bots/${bot.id}/permissions`, { permissions, rev: 0 });
    await owner.req("PUT", `/v1/orgs/${org.id}/bots/${bot.id}/permissions`, { permissions, rev: 0, manifestRev: 1 });
    await link(page, owner);
    await page.goto("/settings/developer");
    const row = page.locator(".dev-item").filter({ hasText: "Voice Helper" }).first();
    await row
      .locator("summary")
      .filter({ hasText: /^Permissions$/ })
      .click();
    const requested = row.getByRole("form", { name: "Requested access" });
    const key1 = publicKey(),
      key2 = publicKey();
    const fingerprint = (key: string) => createHash("sha256").update(Buffer.from(key, "base64")).digest("hex");
    await requested.getByLabel("Bot voice encryption key", { exact: true }).fill(key1);
    await requested.getByRole("button", { name: "Save", exact: true }).click();
    await expect(requested.getByText("Saved.", { exact: true })).toBeVisible();
    expect((await owner.req("GET", `/v2/bots/${bot.id}/permissions`)).voicePublicKey).toBe(key1);
    await expect(requested.getByText(`SHA-256 · ${fingerprint(key1)}`, { exact: true })).toBeVisible();
    await requested.getByLabel("Bot voice encryption key", { exact: true }).fill(key2);
    await expect(requested.getByText(`SHA-256 · ${fingerprint(key1)}`, { exact: true })).toHaveCount(0);
    await requested.getByLabel("Bot voice encryption key", { exact: true }).fill(key1);
    await expect(requested.getByRole("button", { name: "Save", exact: true })).toBeDisabled();

    await page.goto("/workspace/bots");
    const installed = page.locator(".dev-item").filter({ hasText: "Voice Helper" }).first();
    await installed
      .locator("summary")
      .filter({ hasText: /^Permissions$/ })
      .click();
    const approval = installed.getByRole("form", { name: "Approved access" });
    await expect(
      approval.getByText(
        "Call access lets this bot and its developer receive the room's audio, camera video, screen shares and other content shared in the call. A public encryption key and fresh approval are required.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(approval.getByText(`SHA-256 · ${fingerprint(key1)}`, { exact: true })).toBeVisible();
    await expect(approval.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
    await approval.getByRole("button", { name: "Save", exact: true }).click();
    await expect(approval.getByText("Saved.", { exact: true })).toBeVisible();
    expect((await owner.req("GET", `/v1/orgs/${org.id}/bots/${bot.id}/permissions`)).manifestRev).toBe(2);

    await owner.req("PUT", `/v2/developer/bots/${bot.id}/permissions`, { permissions, rev: 2, voicePublicKey: key2 });
    await approval.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(approval.getByText(`SHA-256 · ${fingerprint(key2)}`, { exact: true })).toBeVisible();
    await expect(approval.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
    await owner.req("PUT", `/v2/developer/bots/${bot.id}/permissions`, { permissions, rev: 3, voicePublicKey: key1 });
    await approval.getByRole("button", { name: "Save", exact: true }).click();
    await expect(approval.getByRole("alert")).toBeVisible();
    expect((await owner.req("GET", `/v1/orgs/${org.id}/bots/${bot.id}/permissions`)).manifestRev).toBe(2);
    await approval.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(approval.getByText(`SHA-256 · ${fingerprint(key1)}`, { exact: true })).toBeVisible();
    await approval.getByRole("button", { name: "Save", exact: true }).click();
    await expect(approval.getByText("Saved.", { exact: true })).toBeVisible();
    expect((await owner.req("GET", `/v1/orgs/${org.id}/bots/${bot.id}/permissions`)).manifestRev).toBe(4);
    expect(await approval.evaluate((form) => form.scrollWidth <= form.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: `docs/yapin-parity/part4/screenshots/bot-voice-key-${info.project.name}.png`, fullPage: true });
  } finally {
    await owner.disconnect();
  }
});
