import { finishWelcome } from "./welcome";
import { expect, test, type Page } from "@playwright/test";
import crypto from "node:crypto";
import { emailedCode } from "./mail";
import { newPhone, testAddress } from "./phone";

test.use({ serviceWorkers: "block" });
test.skip(({ isMobile }) => isMobile, "Server channel management on desktop");
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

async function openCreate(page: Page, name: string) {
  await page
    .getByRole("button", { name: new RegExp(`^${name}`) })
    .first()
    .click({ button: "right" });
  await page.getByRole("menu", { name }).getByRole("menuitem", { name: "Create channel", exact: true }).click();
  return page.getByRole("dialog", { name: /Create channel/ });
}

test("rules have a distinct identity, preserve agreement settings, and retry without creating duplicates", async ({ page }) => {
  test.setTimeout(180_000);
  // Exercise the real production bundle without enabling development device linking.
  let authorization = "";
  page.on("request", (request) => {
    const header = request.headers()["authorization"];
    if (header) authorization = header;
  });
  const email = `rules.${crypto.randomBytes(6).toString("hex")}@example.test`;
  await page.goto("/");
  await page.getByRole("button", { name: "Create an account", exact: true }).click();
  await page.getByLabel("Your name", { exact: true }).fill("Rules owner");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a long enough password for local rules verification");
  await page.getByLabel("I am 13 or older. I agree to the Terms and acknowledge the Privacy.", { exact: true }).check();
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.getByLabel("Code", { exact: true }).fill(await emailedCode(email, "verify"));
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("button", { name: "Set up encryption", exact: true }).click();
  await page.getByLabel("I've stored my recovery key somewhere safe.").check();
  await page.getByRole("button", { name: "Open Meldiq", exact: true }).click();
  await finishWelcome(page);
  await expect(page.locator('.app[data-connection="online"]').first()).toBeVisible();
  const owner = {
    async req(method: string, path: string, data?: Record<string, unknown>) {
      expect(authorization).toMatch(/^Bearer /);
      const response = await page.request.fetch(`${process.env.ORBIT_E2E_API}${path}`, {
        method,
        headers: { authorization, "x-forwarded-for": testAddress() },
        ...(data ? { data } : {}),
      });
      expect(response.ok(), `${method} ${path}: ${response.status()}`).toBe(true);
      return response.json();
    },
  };
  const member = await newPhone("rulesreader", "Rules reader");
  const { org } = await owner.req("POST", "/v1/orgs", { name: "Rules Lab" });
  const { invite } = await owner.req("POST", `/v1/orgs/${org.id}/invites`, { role: "MEMBER", maxUses: 1, expiresInHours: 1 });
  await member.req("POST", "/v1/invites/accept", { code: invite.code });
  await owner.req("PUT", `/v1/orgs/${org.id}/rules`, { channelId: null, required: true, rules: [{ title: "Be kind", description: "Respect everyone." }] });
  await page.goto("/home");
  const create = await openCreate(page, "Rules Lab");
  await create.getByRole("radio", { name: /^Rules / }).click();
  await expect(create.getByRole("switch", { name: "Private channel" })).toHaveCount(0);
  await create.getByLabel("Name", { exact: true }).fill("server-rules");
  let failed = false;
  await page.route(`**/v1/orgs/${org.id}/rules`, async (route) => {
    if (route.request().method() === "PUT" && !failed) {
      failed = true;
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "unavailable", message: "Temporary rules save failure" }) });
    } else await route.continue();
  });
  await create.getByRole("button", { name: "Create channel", exact: true }).click();
  await expect(create.getByText(/Retry to finish setting/)).toBeVisible();
  await create.getByRole("button", { name: "Create channel", exact: true }).click();
  await expect(create).toHaveCount(0);
  const rules = await owner.req("GET", `/v1/orgs/${org.id}/rules`);
  expect(rules).toMatchObject({ required: true, rules: [{ title: "Be kind", description: "Respect everyone." }] });
  const channels = (await owner.req("GET", `/v1/orgs/${org.id}/channels`)).channels;
  const created = channels.filter((c: { name: string }) => c.name === "server-rules");
  expect(created).toHaveLength(1);
  expect(created[0]).toMatchObject({ id: rules.channelId, kind: "PUBLIC", voice: false, format: "text", canPost: true });
  await expect(page.locator(".conv-head").getByLabel("Rules", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "#server-rules: details", exact: true }).click();
  await expect(page.getByText(/^Rules channel ·/)).toBeVisible();
  await page.screenshot({ path: `/tmp/meldiq-rules-details.png` });
  await page.getByRole("complementary", { name: "Details", exact: true }).getByRole("button", { name: "Close panel", exact: true }).click();
  await page.getByRole("button", { name: "Browse channels", exact: true }).click();
  const browser = page.getByRole("dialog", { name: "Browse channels", exact: true });
  await expect(browser.getByRole("switch", { name: "Show server-rules", exact: true })).toBeChecked();
  await page.keyboard.press("Escape");
  const again = await openCreate(page, "Rules Lab");
  await expect(again.getByRole("radio", { name: /^Rules / })).toBeDisabled();
  await again.getByRole("button", { name: "Cancel", exact: true }).click();
  await member.req("POST", `/v1/orgs/${org.id}/rules/agree`);
  const memberChannel = (await member.req("GET", `/v1/orgs/${org.id}/channels`)).channels.find((c: { id: string }) => c.id === rules.channelId);
  expect(memberChannel.canPost).toBe(false);
});
