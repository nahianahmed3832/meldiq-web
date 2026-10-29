import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { link } from "./link";
import { newPhone } from "./phone";

/**
 * Community parity B (docs/MELDIQ_COMMUNITY_PARITY.md › Lobby): the first visit lands on the lobby, an editor starts from
 * "nothing here yet", the live editor restyles the page as the draft changes and saves it, templates apply, and
 * Community settings › Lobby is the reference's page. Needs a server with the community-lobby feature.
 */
test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "desktop Chromium");
const SHOTS = process.env.ORBIT_E2E_SHOTS;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
};

test("the lobby: first visit, the live editor, templates and its settings page", async ({ page }) => {
  const alice = await newPhone("lobbyalice", "Alice Rahman");
  const { org } = await alice.req("POST", "/v1/orgs", { name: "Night Owls" });
  const info = await alice.req("GET", "/v1/server-info").catch(() => ({ features: [] }));
  test.skip(!(info.features ?? []).includes("community-lobby"), "the server has no community-lobby feature");
  const { channels } = await alice.req("GET", `/v1/orgs/${org.id}/channels`);
  await alice.connect();
  await link(page, alice);

  // Opening the community the first time lands on its lobby; an editor sees where to start.
  await expect(page).toHaveURL(/\/lobby$/);
  // Seen now: Home stays Home after that.
  await page.goto("/home");
  await expect(page.getByText(/what's happening in Night Owls/)).toBeVisible();
  await expect(page).toHaveURL(/\/home$/);
  await page.getByRole("button", { name: "Lobby", exact: true }).click();
  const lobby = page.getByRole("region", { name: "Night Owls lobby" });
  await expect(lobby.getByRole("heading", { level: 1, name: "Night Owls" })).toBeVisible();
  await expect(lobby.getByText("Nothing here yet")).toBeVisible();
  await expect(page.getByRole("button", { name: "Lobby", exact: true })).toHaveAttribute("aria-current", "page");
  await shot(page, "lobby-empty");

  // Customize: the editor beside the page; writing the intro shows on the page as it's typed.
  await lobby.getByRole("button", { name: "Write an intro" }).click();
  const editor = page.getByRole("complementary", { name: "Customize lobby" });
  await expect(editor).toBeVisible();
  await editor.getByLabel("About", { exact: true }).fill("**Welcome!** We build small games at night.\n\n- Show your work\n- Be kind");
  await expect(lobby.getByRole("region", { name: "About" }).getByText("Welcome!")).toBeVisible();
  await expect(editor.getByText("1 change")).toBeVisible();
  await shot(page, "editor-about");

  await editor.getByRole("button", { name: "Back to all sections" }).click();
  await editor.getByRole("tab", { name: "Look" }).click();
  await editor.getByRole("button", { name: /Magazine/ }).click();
  await editor.getByRole("button", { name: "Glass" }).click();
  await expect(lobby.locator(".lobby.layout-magazine.cards-glass")).toBeVisible();
  await shot(page, "editor-look");
  await editor.getByRole("button", { name: "Save" }).click();
  await expect(editor.getByText("No changes yet")).toBeVisible();

  // Filled in from the phone meanwhile: the editor's revision is stale, so a save is refused and the newer one loads.
  const current = await alice.req("GET", `/v1/orgs/${org.id}/lobby/settings`);
  await alice.req("PUT", `/v1/orgs/${org.id}/lobby/settings`, {
    rev: current.rev,
    tagline: "Small games, late nights",
    buttons: [
      { label: "Say hi", channelId: channels[0].id },
      { label: "Our site", url: "https://owls.example" },
    ],
    faq: [{ question: "Is it free?", answer: "Yes, always." }],
  });
  await editor.getByRole("tab", { name: "Look" }).click();
  await editor.getByRole("button", { name: "Serif" }).click();
  await editor.getByRole("button", { name: "Save" }).click();
  await expect(editor.getByText(/Someone else changed the lobby/)).toBeVisible();
  await expect(lobby.getByText("Small games, late nights")).toBeVisible();

  await editor.getByRole("tab", { name: "Sections" }).click();
  await expect(editor.getByRole("button", { name: /Main channels/ })).toBeVisible();
  await shot(page, "editor-sections");

  await editor.getByRole("tab", { name: "Templates" }).click();
  await editor.getByRole("button", { name: /Gaming/ }).click();
  await expect(lobby.locator(".lobby.layout-classic.font-display")).toBeVisible();
  await shot(page, "editor-template-gaming");

  await editor.getByRole("button", { name: "Phone", exact: true }).click();
  await expect(page.locator(".lobby-canvas.phone-preview")).toBeVisible();
  await shot(page, "editor-phone-preview");
  await editor.getByRole("button", { name: "Close the editor" }).click();
  await expect(editor).toHaveCount(0);
  await shot(page, "lobby-gaming");

  // The light theme too (the look's colours come from the theme's tokens).
  const theme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  await page.waitForTimeout(600); // the theme's colour transitions settle
  await shot(page, "lobby-gaming-light");
  await page.evaluate((t) => (t ? document.documentElement.setAttribute("data-theme", t) : document.documentElement.removeAttribute("data-theme")), theme);

  // Community settings › Lobby.
  await page.goto("/workspace/lobby");
  const window = page.getByRole("dialog", { name: "Night Owls settings" });
  await expect(window.getByRole("heading", { level: 1, name: "Lobby" })).toBeVisible();
  await expect(window.getByRole("button", { name: /Open the live editor/ })).toBeVisible();
  await expect(window.getByLabel("Show who runs it")).toBeVisible();
  await shot(page, "settings-lobby");
  await window.getByRole("button", { name: /Open the live editor/ }).click();
  await expect(page.getByRole("complementary", { name: "Customize lobby" })).toBeVisible();

  // Phones: one column.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/lobby");
  await expect(page.getByRole("heading", { level: 1, name: "Night Owls" })).toBeVisible();
  await shot(page, "phone-lobby");
});
