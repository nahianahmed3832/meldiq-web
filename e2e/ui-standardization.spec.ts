import path from "node:path";
import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ context }) => context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() }));

test("settings have one home, searchable navigation, and real storage and about pages", async ({ page, isMobile }, info) => {
  const alice = await newPhone("uicatalog", "UI Explorer");
  await link(page, alice);
  await page.goto("/settings/you");
  const nav = page.getByRole("navigation", { name: "Settings pages" });
  await expect(nav.getByRole("button", { name: "Language", exact: true })).toBeVisible();
  await expect(nav.getByRole("button", { name: "Accessibility", exact: true })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search settings", exact: true }).fill("microphone");
  await expect(nav.getByRole("button", { name: /Voice & Audio/ })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search settings", exact: true }).fill("");
  await nav.getByRole("button", { name: "Accessibility", exact: true }).click();
  await expect(page.getByRole("switch", { name: "Higher contrast" })).toBeVisible();
  if (isMobile) {
    const target = await page.getByRole("switch", { name: "Higher contrast" }).boundingBox();
    expect(target!.width).toBeGreaterThanOrEqual(44);
    expect(target!.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole("switch", { name: "Higher contrast" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-contrast", "high");
  await page.goto("/settings/appearance");
  await expect(page.getByRole("switch", { name: "Higher contrast" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Choose language" })).toHaveCount(0);
  await page.goto("/settings/notifications");
  await expect(page.getByRole("switch", { name: /Read receipts|Typing/ })).toHaveCount(0);
  await page.goto("/settings/security");
  await expect(page.getByRole("switch", { name: "Send read receipts", exact: true })).toBeVisible();
  await page.goto("/settings/storage");
  await expect(page.getByText("Used on this computer", { exact: true })).toBeVisible();
  await page.goto("/settings/about");
  await expect(page.getByRole("heading", { name: "About", exact: true })).toBeVisible();
  await page.goto("/settings/health");
  await expect(page.getByRole("heading", { name: "This page is unavailable" })).toBeVisible();
  if (isMobile) await page.goto("/settings/you");
  else await page.goto("/settings/appearance");
  expect(await page.locator(".settings").evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await page.screenshot({ animations: "disabled", path: path.join("/tmp/meldiq-ui-audit", `settings-${info.project.name}.png`) });
});

test("profile drafts survive canceled navigation and are discarded only after confirmation", async ({ page, isMobile }) => {
  const alice = await newPhone("uidraft", "Original Profile");
  await link(page, alice);
  await page.goto("/settings/you");
  await page.getByRole("navigation", { name: "Settings pages" }).getByRole("button", { name: "My Profile", exact: true }).click();
  const name = page.getByRole("textbox", { name: "Display name", exact: true });
  await name.fill("Unsaved Profile");
  await expect(page.getByText("You have unsaved changes.", { exact: true })).toBeVisible();
  if (isMobile) await page.getByRole("button", { name: "Back to settings", exact: true }).click();
  else await page.getByRole("navigation", { name: "Settings pages" }).getByRole("button", { name: "Appearance", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "Discard unsaved changes?" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Keep editing" }).click();
  await expect(name).toHaveValue("Unsaved Profile");
  await page.evaluate(() => history.back());
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Keep editing" }).click();
  await expect(page).toHaveURL(/\/settings\/profile$/);
  await expect(name).toHaveValue("Unsaved Profile");
  if (isMobile) await page.getByRole("button", { name: "Back to settings", exact: true }).click();
  else await page.getByRole("navigation", { name: "Settings pages" }).getByRole("button", { name: "Appearance", exact: true }).click();
  await confirm.getByRole("button", { name: "Discard changes", exact: true }).click();
  await expect(confirm).toHaveCount(0);
  expect((await alice.req("GET", "/v1/users/me")).user.displayName).toBe("Original Profile");
});

test("community settings are scoped, responsive, and block unauthorized direct links", async ({ page, isMobile }, info) => {
  const alice = await newPhone("uiowner", "UI Owner");
  const bob = await newPhone("uimember", "UI Member");
  const { org } = await alice.req("POST", "/v1/orgs", { name: "Unified Community" });
  const { invite } = await alice.req("POST", `/v1/orgs/${org.id}/invites`, { role: "MEMBER", maxUses: 1, expiresInHours: 1 });
  await bob.req("POST", "/v1/invites/accept", { code: invite.code });
  await link(page, alice);
  for (const route of ["overview", "discovery", "security", "notifications", "integrations", "channels", "roles"]) {
    await page.goto(`/workspace/${route}`);
    await expect(page.getByRole("heading", { name: "This page is unavailable" })).toHaveCount(0);
    if (route !== "notifications") await expect(page.getByText("Changes here apply to this community. Personal preferences stay in User Settings.", { exact: true })).toBeVisible();
    expect(await page.locator(".settings-page").evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  }
  await page.goto("/workspace/notifications");
  await expect(page.getByRole("radiogroup", { name: "Community notifications" })).toBeVisible();
  if (isMobile) {
    const select = page.getByRole("combobox", { name: "Community settings page" });
    await select.selectOption("channels");
    await expect(page).toHaveURL(/\/workspace\/channels$/);
  } else {
    await page.getByRole("searchbox", { name: "Search community settings" }).fill("roles");
    await expect(page.getByRole("navigation", { name: "Community settings" }).getByRole("button", { name: "Roles", exact: true })).toBeVisible();
  }
  await page.screenshot({ animations: "disabled", path: path.join("/tmp/meldiq-ui-audit", `community-${info.project.name}.png`) });
  // The same membership in a separate signed-in browser must not expose administrative forms via a URL.
  const memberContext = await page
    .context()
    .browser()!
    .newContext({ viewport: page.viewportSize() ?? undefined });
  await memberContext.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
  const memberPage = await memberContext.newPage();
  await link(memberPage, bob);
  await memberPage.goto("/workspace/discovery");
  await expect(memberPage.getByRole("heading", { name: "This page is unavailable" })).toBeVisible();
  await expect(memberPage.getByRole("radiogroup", { name: "Who can find it" })).toHaveCount(0);
  await memberContext.close();
});

test("channel creation and editing use shared dialogs and archives require confirmation", async ({ page }) => {
  const alice = await newPhone("uichannel", "Channel Owner");
  const { org } = await alice.req("POST", "/v1/orgs", { name: "Channel Studio" });
  await link(page, alice);
  await page.goto("/workspace/channels");
  await page.getByRole("button", { name: "Create channel", exact: true }).click();
  const create = page.getByRole("dialog", { name: "Create channel", exact: true });
  await create.getByLabel("Name", { exact: true }).fill("release-notes");
  await create.getByRole("button", { name: "Create channel", exact: true }).click();
  await expect(create).toHaveCount(0);
  const channels = (await alice.req("GET", "/v1/conversations")).conversations as { id: string; name: string; orgId: string }[];
  const channel = channels.find((c) => c.orgId === org.id && c.name === "release-notes")!;
  expect(channel).toBeTruthy();
  await page.goto("/workspace/channels");
  await page
    .getByRole("button", { name: "Edit #release-notes" })
    .or(page.getByRole("button", { name: "Edit release-notes", exact: true }))
    .click();
  const edit = page.getByRole("dialog", { name: /Edit .*release-notes/ });
  await expect(edit.getByRole("tab", { name: "Overview", exact: true })).toBeVisible();
  await expect(edit.getByRole("tab", { name: "Permissions", exact: true })).toBeVisible();
  await edit.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Archive release-notes", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "Confirm", exact: true });
  await expect(confirm).toContainText("release-notes");
  await confirm.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("button", { name: "Archive release-notes", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Archive release-notes", exact: true }).click();
  await confirm.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByRole("list", { name: "Archived channels", exact: true })).toContainText("release-notes");
});
