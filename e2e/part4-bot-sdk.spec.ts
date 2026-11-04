import crypto from "node:crypto";
import fs from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { newPhone, testAddress } from "./phone";
import { link } from "./link";

test.use({ actionTimeout: 15_000 });
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

test("the developer screen downloads the exact pinned first-party SDK and guide", async ({ page }) => {
  const owner = await newPhone("sdkdownload", "SDK Developer");
  try {
    await link(page, owner);
    await page.goto("/settings/developer");
    const help = page.getByRole("region", { name: "Bots", exact: true }).locator(".dev-how");
    await help.locator("summary").click();
    const manifestResponse = await page.request.get("/developers/bot-sdk/manifest.json");
    expect(manifestResponse.ok()).toBe(true);
    const manifest = await manifestResponse.json();
    expect(manifest.apiCommit).toBe((await fs.readFile("test/contract-source.txt", "utf8")).trim());
    expect(manifest.files).toHaveLength(10);
    const [download] = await Promise.all([page.waitForEvent("download"), help.getByRole("link", { name: "Download · JavaScript / Python", exact: true }).click()]);
    expect(await download.failure()).toBeNull();
    expect(download.suggestedFilename()).toBe("meldiq-bot-sdk-preview.zip");
    const bytes = await fs.readFile((await download.path())!);
    expect(bytes.subarray(0, 2).toString()).toBe("PK");
    expect(crypto.createHash("sha256").update(bytes).digest("hex")).toBe(manifest.archiveSha256);
    const guide = help.getByRole("link", { name: "How bots work", exact: true });
    const response = await page.request.get((await guide.getAttribute("href"))!);
    expect(response.headers()["content-type"]).toContain("text/plain");
    expect(await response.text()).toContain("Personal bot DMs require");
  } finally {
    await owner.disconnect();
  }
});
