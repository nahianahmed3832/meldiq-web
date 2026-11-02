import { expect, test } from "@playwright/test";
import crypto from "node:crypto";
import { emailedCode } from "./mail";
import { newPhone, testAddress } from "./phone";

test.use({ serviceWorkers: "block" });
test.skip(({ isMobile }) => isMobile, "includes its own desktop and phone viewport checks");
test.setTimeout(300_000);

test("owner priority, editable role heading, themed PLUS and persistent bot labels", async ({ page, context }, info) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
  // Use normal email onboarding against the exact production export, without development device linking.
  let authorization = "";
  page.on("request", (request) => {
    authorization = request.headers()["authorization"] || authorization;
  });
  const email = `identity.${crypto.randomBytes(6).toString("hex")}@example.test`;
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Create an account", exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Create an account", exact: true }).click();
  await page.getByLabel("Your name", { exact: true }).fill("Zoya Rahman");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a long enough password for identity verification");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.getByLabel("Code", { exact: true }).fill(await emailedCode(email, "verify"));
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("button", { name: "Set up encryption", exact: true }).click();
  await page.getByLabel("I've stored my recovery key somewhere safe.").check();
  await page.getByRole("button", { name: "Open Meldiq", exact: true }).click();
  await expect(page.locator('.app[data-connection="online"]').first()).toBeVisible();
  const req = async (method: string, path: string, data?: Record<string, unknown>) => {
    expect(authorization).toMatch(/^Bearer /);
    const response = await page.request.fetch(`${process.env.ORBIT_E2E_API}${path}`, {
      method,
      headers: { authorization, "x-forwarded-for": testAddress() },
      ...(data ? { data } : {}),
    });
    expect(response.ok(), `${method} ${path}: ${response.status()}`).toBe(true);
    return response.json();
  };
  const owner = { userId: (await req("GET", "/v1/users/me")).user.id as string, req };
  const mod = await newPhone("identitymod", "Mina Ahmed");
  const { org } = await owner.req("POST", "/v1/orgs", { name: "The Makers Club" });
  const { invite } = await owner.req("POST", `/v1/orgs/${org.id}/invites`, { role: "MEMBER", maxUses: 1 });
  await mod.req("POST", "/v1/invites/accept", { code: invite.code });
  const { role: staff } = await owner.req("POST", `/v1/orgs/${org.id}/roles`, { name: "Moderators", hoist: true, color: "#c4a7e7", permissions: [] });
  await owner.req("PUT", `/v1/roles/${staff.id}/members/${mod.userId}`);
  const { role: founders } = await owner.req("POST", `/v1/orgs/${org.id}/roles`, { name: "Founders", hoist: false, permissions: [] });
  await owner.req("PUT", `/v1/roles/${founders.id}/members/${owner.userId}`);
  await owner.req("PUT", `/v1/orgs/${org.id}/official-bots/helper`, { enabled: true, look: { name: "Community Guide For Makers Club" } });
  const channels = (await owner.req("GET", "/v1/conversations")).conversations as { id: string; orgId: string; name: string }[];
  const channel = channels.find((c) => c.orgId === org.id && c.name === "general")!;
  await mod.req("POST", `/v1/conversations/${channel.id}/join`).catch(() => undefined);
  await mod.connect();
  // Subscription display fixture only; no entitlement or subscription is granted to a test account.
  await page.route(`**/v1/conversations/${channel.id}/members`, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.members = body.members.map((m: { id: string }) => (m.id === owner.userId ? { ...m, mojo: { badge: "plus", check: true } } : m));
    await route.fulfill({ response, json: body });
  });
  await page.goto(`/home/c/${channel.id}`);
  const list = page.locator("aside.member-list");
  await expect(list.locator(".member-group").first()).toHaveText("Admin — 1");
  await expect(list.locator(".member-row").first()).toContainText("Zoya Rahman");
  // Installed bots are visible through the community directory, even when the channel endpoint omits them.
  const botSection = list.locator("section").filter({ has: page.locator(".member-group", { hasText: /^Bots/ }) });
  await expect(botSection.locator(".bot-tag")).toHaveText("BOT");
  const composer = page.getByRole("textbox", { name: /^Message/ });
  await composer.fill("!roll 1d6");
  await composer.press("Enter");
  await expect(page.locator(".msg .bot-tag").first()).toBeVisible();
  await page.reload();
  await expect(botSection.locator(".bot-tag")).toHaveText("BOT");
  await expect(list.locator(".mojo-badge")).toHaveText("PLUS");
  await expect(list.locator(".mojo-badge svg")).toHaveCount(0);
  const paints: string[] = [];
  for (const [palette, theme] of [
    ["meldiq", "dark"],
    ["plum", "dark"],
    ["indigo", "light"],
  ]) {
    await page.evaluate(
      ([palette, theme]) => {
        document.documentElement.dataset.palette = palette;
        document.documentElement.dataset.theme = theme;
      },
      [palette, theme],
    );
    paints.push(await list.locator(".mojo-badge").evaluate((el) => getComputedStyle(el).backgroundImage));
    expect(await list.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await list.screenshot({ path: info.outputPath(`members-${palette}-${theme}.png`) });
  }
  expect(new Set(paints).size).toBe(3);
  await page.evaluate(() => {
    document.documentElement.dataset.palette = "meldiq";
    document.documentElement.dataset.theme = "dark";
  });
  // Editing an existing role refreshes the directory immediately, including its custom owner heading.
  await page.getByRole("button", { name: "Community: The Makers Club. Community menu" }).click();
  await page.getByRole("menuitem", { name: /Community settings/ }).click();
  const settings = page.getByRole("dialog", { name: "The Makers Club settings" });
  await settings.getByRole("navigation", { name: "Community settings" }).getByRole("button", { name: "Roles" }).click();
  await settings
    .getByRole("list", { name: "Custom roles" })
    .getByRole("button", { name: /^Founders/ })
    .click();
  const editor = page.getByRole("dialog", { name: "Edit role - Founders" });
  await editor.getByLabel("Role name", { exact: true }).fill("Council");
  await editor.getByRole("switch", { name: "Show members separately" }).click();
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await settings.getByRole("button", { name: "Close settings" }).click();
  await expect(list.locator(".member-group").first()).toHaveText("Council — 1");
  await expect(list.locator(".member-row").first()).toContainText("Zoya Rahman");
  await expect(botSection.locator(".bot-tag")).toHaveText("BOT");
  await list.screenshot({ path: info.outputPath("owner-custom-heading.png") });
  const panelBox = await list.boundingBox();
  const lastRow = await list.locator(".member-row").last().boundingBox();
  if (panelBox && lastRow) {
    await page.screenshot({
      path: info.outputPath("community-identity-preview.png"),
      clip: { x: panelBox.x, y: panelBox.y, width: panelBox.width, height: Math.min(panelBox.height, lastRow.y + lastRow.height - panelBox.y + 20) },
    });
  }
  await botSection.locator(".member-row").click();
  const details = page.getByRole("dialog", { name: "Bot details", exact: true });
  await expect(details.locator(".bot-tag")).toHaveText("BOT");
  await expect(details).toContainText("Automated community account");
  await details.getByRole("button", { name: "Done", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/home/c/${channel.id}/members`);
  await expect(list).toBeVisible();
  await expect(list.locator(".member-group").first()).toHaveText("Council — 1");
  await expect(botSection.locator(".bot-tag")).toBeVisible();
  expect(await list.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("phone-member-list.png") });
});
