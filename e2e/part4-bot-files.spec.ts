import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { newPhone, testAddress } from "./phone";
import { link } from "./link";

test.describe.configure({ timeout: 180_000 });
test.use({ serviceWorkers: "block", actionTimeout: 15_000 });
test.beforeEach(async ({ context }) => context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() }));

test("separate file review gates a bot upload and the human client decrypts its native attachment", async ({ page }, info) => {
  const owner = await newPhone("filebotowner", "File Bot Owner");
  try {
    const { org } = await owner.req("POST", "/v1/orgs", { name: "File sharing review" });
    const channel = (await owner.req("GET", `/v1/orgs/${org.id}/channels`)).channels.find((c: { name: string }) => c.name === "general").id;
    const made = await owner.req("POST", "/v2/developer/bots", { name: "File Helper", public: true });
    await owner.req("POST", `/v1/orgs/${org.id}/bots`, { botId: made.bot.id });
    await owner.req("PUT", `/v2/developer/bots/${made.bot.id}/permissions`, { permissions: ["messages.post"], rev: 0 });
    await owner.req("PUT", `/v1/orgs/${org.id}/bots/${made.bot.id}/permissions`, { permissions: ["messages.post"], manifestRev: 1, rev: 0 });
    const sdkRoot = path.join(process.env.ORBIT_SERVER_DIR!, "sdk/javascript");
    const { MeldiqBot } = await import(pathToFileURL(path.join(sdkRoot, "index.mjs")).href);
    const { encryptAttachmentBytes } = await import(pathToFileURL(path.join(sdkRoot, "attachments.mjs")).href);
    const bot = new MeldiqBot({ apiOrigin: process.env.ORBIT_E2E_API, token: made.token });
    const plain = Buffer.from("A native encrypted attachment sent by the approved helper.\n");
    const encrypted = encryptAttachmentBytes(plain, { name: "helper-note.txt", mime: "text/plain" });
    await expect(bot.uploadAttachment(channel, encrypted.bytes)).rejects.toMatchObject({ status: 403 });

    await link(page, owner);
    await page.goto("/settings/developer");
    const row = page.locator(".dev-item").filter({ hasText: "File Helper" }).first();
    await row
      .locator("summary")
      .filter({ hasText: /^Permissions$/ })
      .click();
    const requested = row.getByRole("form", { name: "Requested access" });
    await requested.getByRole("checkbox", { name: /^Share files/ }).check();
    await requested.getByRole("checkbox", { name: "Files · Download", exact: true }).focus();
    await page.keyboard.press("Space");
    await expect(requested.getByRole("checkbox", { name: "Files · Download", exact: true })).toBeChecked();
    await requested.getByRole("button", { name: "Save", exact: true }).click();
    await expect(requested.getByText("Saved.", { exact: true })).toBeVisible();
    await expect(bot.uploadAttachment(channel, encrypted.bytes)).rejects.toMatchObject({ status: 403 });

    await page.goto("/workspace/bots");
    const installed = page.locator(".dev-item").filter({ hasText: "File Helper" }).first();
    await installed
      .locator("summary")
      .filter({ hasText: /^Permissions$/ })
      .click();
    const approval = installed.getByRole("form", { name: "Approved access" });
    await expect(approval.getByRole("checkbox", { name: /^Share files/ })).not.toBeChecked();
    await expect(approval.getByRole("checkbox", { name: "Files · Download", exact: true })).not.toBeChecked();
    await approval.getByRole("checkbox", { name: /^Share files/ }).check();
    await approval.getByRole("checkbox", { name: "Files · Download", exact: true }).check();
    await approval.getByRole("button", { name: "Save", exact: true }).click();
    await expect(approval.getByText("Saved.", { exact: true })).toBeVisible();

    const stored = await bot.uploadAttachment(channel, encrypted.bytes);
    await bot.send(channel, "A file from the approved helper.", { attachments: [{ ...encrypted.reference, id: stored.id }] });
    await page.goto(`/dms/c/${channel}`);
    const messages = page.getByRole("log", { name: "Messages", exact: true });
    await expect(messages.getByText("A file from the approved helper.", { exact: true })).toBeVisible();
    await expect(messages.getByText("BOT", { exact: true }).first()).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await messages.getByRole("button", { name: /^Download helper-note\.txt/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("helper-note.txt");
    expect(await fs.readFile((await download.path())!)).toEqual(plain);
    const review = await owner.req("GET", `/v1/orgs/${org.id}/bots/${made.bot.id}/permissions`);
    await owner.req("PUT", `/v1/orgs/${org.id}/bots/${made.bot.id}/permissions`, { permissions: ["messages.post", "files.upload"], manifestRev: 2, rev: review.rev });
    await expect(bot.downloadAttachment(stored.id).next()).rejects.toMatchObject({ status: 403 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `docs/yapin-parity/part4/screenshots/bot-file-${info.project.name}.png`, fullPage: true });
  } finally {
    await owner.disconnect();
  }
});
