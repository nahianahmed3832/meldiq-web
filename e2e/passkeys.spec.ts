import crypto from "node:crypto";
import { type BrowserContext, type CDPSession, expect, type Page, test } from "@playwright/test";
import { expectSignedOut } from "./link";
import { emailedCode } from "./mail";
import { testAddress } from "./phone";

/**
 * Passkeys on the web (server docs/PASSKEYS.md, API 0.30.0) with Chromium's virtual authenticator (CDP WebAuthn): add one
 * in Settings › Account, sign in with it in another browser holding the same (synced) passkey, remove it. The test server
 * makes http://localhost:5181 a relying party of its own (PASSKEY_WEB_ORIGINS in playwright.config.ts): WebAuthn needs a
 * host name, so these pages use localhost rather than 127.0.0.1, where passkeys aren't offered.
 */
const WEB = "http://localhost:5181";
const PASSWORD = "a long enough password";

test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "CDP WebAuthn is Chromium's; one desktop run is enough");

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

/** A platform authenticator with user verification (a screen lock) that answers every prompt by itself. */
async function authenticator(page: Page): Promise<{ cdp: CDPSession; id: string }> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  return { cdp, id: authenticatorId };
}

async function openWeb(context: BrowserContext): Promise<Page> {
  await context.addInitScript(() => localStorage.setItem("meldiq.introSeen", "1"));
  const page = await context.newPage();
  await page.goto(`${WEB}/`);
  await expectSignedOut(page);
  return page;
}

test("add a passkey in Settings, sign in with it in another browser, then remove it", async ({ page, browser }) => {
  // Not offered where WebAuthn can't work (an IP address), even by a server that has passkeys.
  await page.goto("/");
  await expectSignedOut(page);
  await expect(page.getByRole("button", { name: "Sign in with a passkey" })).toHaveCount(0);

  const first = await openWeb(page.context());
  const key = await authenticator(first);
  const email = `e2e.passkey.${crypto.randomBytes(4).toString("hex")}@example.test`;
  await first.getByRole("button", { name: "Create an account" }).click();
  await first.getByLabel("Your name").fill("Passkey Person");
  await first.getByLabel("Email").fill(email);
  await first.getByLabel("Password").fill(PASSWORD);
  await first.getByRole("button", { name: "Create account" }).click();
  await first.getByLabel("Code").fill(await emailedCode(email, "verify"));
  await first.getByRole("button", { name: "Confirm" }).click();
  await first.getByRole("button", { name: "Set up encryption" }).click();
  await first.getByLabel("I've stored my recovery key somewhere safe.").check();
  await first.getByRole("button", { name: "Open Meldiq" }).click();
  await expect(first.locator(":is(.conn.online, .user-panel[data-connection=online]):visible")).toBeVisible({ timeout: 15_000 });

  await first.goto(`${WEB}/settings/account`);
  const card = first.getByLabel("Passkeys", { exact: true });
  await expect(card).toContainText("Forget about your password");
  await card.getByRole("button", { name: "Add a passkey" }).click();
  await expect(card.getByRole("status")).toContainText("Passkey added");
  await expect(card.getByRole("listitem")).toHaveCount(1);
  await expect(card.getByRole("listitem")).toContainText(/Chrome on \w+/);
  await expect(card.getByRole("listitem")).toContainText("never used");
  const { credentials } = await key.cdp.send("WebAuthn.getCredentials", { authenticatorId: key.id });
  expect(credentials).toHaveLength(1);
  expect(credentials[0]).toMatchObject({ rpId: "localhost", isResidentCredential: true });

  // Another browser whose password manager has the same passkey (as a synced one would): signs in without the password,
  // then sets itself up like after a password sign-in.
  const otherContext = await browser.newContext({ extraHTTPHeaders: { "x-orbit-test-ip": testAddress() } });
  const second = await openWeb(otherContext);
  const synced = await authenticator(second);
  await synced.cdp.send("WebAuthn.addCredential", { authenticatorId: synced.id, credential: credentials[0] });
  await second.getByRole("button", { name: "Sign in with a passkey" }).click();
  await expect(second.getByRole("heading", { name: "Set up this browser" })).toBeVisible();
  await expect(second.getByText(email).first()).toBeVisible();

  await first.reload();
  await expect(card.getByRole("listitem")).toContainText("used ");
  await expect(card.getByRole("listitem")).not.toContainText("never used");

  // Removed: it no longer signs in, and the server says so.
  await card.getByRole("button", { name: /^Remove / }).click();
  await card.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(card.getByRole("listitem")).toHaveCount(0);
  await expect(card).toContainText("Forget about your password");
  const third = await openWeb(await browser.newContext({ extraHTTPHeaders: { "x-orbit-test-ip": testAddress() } }));
  const stale = await authenticator(third);
  await stale.cdp.send("WebAuthn.addCredential", { authenticatorId: stale.id, credential: credentials[0] });
  await third.getByRole("button", { name: "Sign in with a passkey" }).click();
  await expect(third.getByRole("alert")).toContainText("isn't registered here");
  await otherContext.close();
});

test("closing the passkey prompt is not an error", async ({ page }) => {
  const web = await openWeb(page.context());
  // No authenticator holds a passkey for this site: Chromium ends the prompt as NotAllowedError, as when it's closed.
  const key = await authenticator(web);
  await key.cdp.send("WebAuthn.setUserVerified", { authenticatorId: key.id, isUserVerified: false });
  await web.getByRole("button", { name: "Sign in with a passkey" }).click();
  await expect(web.getByRole("button", { name: "Sign in with a passkey" })).toBeEnabled({ timeout: 20_000 });
  await expect(web.getByRole("alert")).toHaveCount(0);
});
