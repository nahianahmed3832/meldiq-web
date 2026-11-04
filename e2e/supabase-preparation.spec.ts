import { finishWelcome } from "./welcome";
import crypto from "node:crypto";
import { expect, test } from "@playwright/test";
import { emailedCode } from "./mail";
import { expectSignedOut } from "./link";
import { testAddress } from "./phone";

const project = "bkvlxbsnzqkhbifawcww",
  authUserId = "10000000-0000-4000-8000-000000000001",
  sessionId = "20000000-0000-4000-8000-000000000001";
const token = `eyJhbGciOiJFUzI1NiJ9.${Buffer.from(JSON.stringify({ sub: authUserId, session_id: sessionId, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.signature`;
test.use({ viewport: { width: 390, height: 844 } });

test("staging test sign-in preserves the browser and legacy session, and production rollback hides the preview", async ({ page, context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
  let staging = true,
    providerCalls = 0,
    logoutCalls = 0,
    linked = false;
  let accountId = "",
    userId = "",
    deviceId = "",
    signingKey = "",
    legacyBearer = "";
  const email = `migration.${crypto.randomBytes(5).toString("hex")}@example.test`,
    password = "long synthetic test password";
  await context.route("**/config.json", (route) =>
    route.fulfill({
      json: {
        environment: staging ? "staging" : "production",
        apiBase: "",
        ...(staging
          ? {
              supabaseMigration: {
                mode: "staging-check",
                projectRef: project,
                url: `https://${project}.supabase.co`,
                publishableKey: "sb_publishable_synthetic_test_key",
              },
            }
          : {}),
      },
    }),
  );
  await context.route(`https://${project}.supabase.co/auth/v1/**`, async (route) => {
    providerCalls++;
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/token")) {
      expect(route.request().postDataJSON()).toMatchObject({ email, password });
      return route.fulfill({
        json: {
          access_token: token,
          refresh_token: "synthetic_browser_refresh_token",
          expires_in: 3600,
          token_type: "bearer",
          user: { id: authUserId, aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
        },
      });
    }
    expect(url.pathname.endsWith("/logout")).toBe(true);
    expect(url.searchParams.get("scope")).toBe("local");
    logoutCalls++;
    return route.fulfill({ status: 204, body: "" });
  });
  page.on("request", (request) => {
    if (request.url().includes("/v2/account/identities")) legacyBearer = request.headers().authorization ?? "";
  });
  await context.route("**/v3/auth/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    expect(request.headers().authorization).toBe(`Bearer ${token}`);
    if (url.pathname.endsWith("/legacy-link")) {
      const body = request.postDataJSON();
      expect(body.deviceId).toBe(deviceId);
      expect(`Bearer ${body.legacyAccessToken}`).toBe(legacyBearer);
      const key = crypto.createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(signingKey, "base64")]), format: "der", type: "spki" });
      expect(crypto.verify(null, Buffer.from(`meldiq-supabase-device-v1\n${authUserId}\n${sessionId}\n${deviceId}\n${body.nonce}`), key, Buffer.from(body.signature, "base64"))).toBe(true);
      linked = true;
      return route.fulfill({ json: { ok: true } });
    }
    if (url.pathname.endsWith("/me")) {
      expect(linked).toBe(true);
      return route.fulfill({ json: { authUserId, accountId, userId } });
    }
    expect(request.method()).toBe("DELETE");
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto("/");
  await expectSignedOut(page);
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Your name").fill("Synthetic migration check");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("I am 13 or older. I agree to the Terms and acknowledge the Privacy.", { exact: true }).check();
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.getByLabel("Code", { exact: true }).fill(await emailedCode(email, "verify"));
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("button", { name: "Set up encryption", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Save your recovery key" })).toBeVisible();
  await page.getByLabel("I've stored my recovery key somewhere safe.").check();
  await page.getByRole("button", { name: "Open Meldiq", exact: true }).click();
  await finishWelcome(page);
  await expect(page.locator(".app[data-connection=online]").first()).toBeVisible({ timeout: 20000 });
  const before = await page.evaluate(
    () =>
      new Promise<{ accountId: string; userId: string; deviceId: string; signingKey: string }>((resolve, reject) => {
        const open = indexedDB.open("orbit-web");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const get = db.transaction("kv").objectStore("kv").get("device");
          get.onsuccess = () => {
            const value = get.result;
            db.close();
            resolve({ accountId: value.account.id, userId: value.userId, deviceId: value.deviceId, signingKey: value.keys.signingPublic });
          };
        };
      }),
  );
  ({ accountId, userId, deviceId, signingKey } = before);
  await page.goto("/settings/account");
  const card = page.getByRole("region", { name: "Staging sign-in check" });
  await expect(card).toBeVisible();
  await card.getByLabel("Test sign-in password").fill(password);
  await card.getByRole("button", { name: "Check test sign-in", exact: true }).click();
  await expect(card.getByRole("status")).toHaveText("Test sign-in verified and closed. Your current Meldiq session stays active.");
  expect(linked).toBe(true);
  expect(logoutCalls).toBe(1);
  expect(providerCalls).toBe(2);
  await expect(card.getByLabel("Test sign-in password")).toHaveValue("");
  const callsBefore = providerCalls;
  staging = false;
  await page.reload();
  await expect(page.getByRole("heading", { name: "My Account", exact: true })).toBeVisible();
  await expect(card).toHaveCount(0);
  await expect(page.locator(".app[data-connection=online]").first()).toBeVisible({ timeout: 20000 });
  expect(providerCalls).toBe(callsBefore);
});

test("normal production sign-in starts without a Supabase connection or migration control", async ({ page, context }) => {
  let providerRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("supabase.co")) providerRequests++;
  });
  await context.route("**/config.json", (route) => route.fulfill({ json: { apiBase: "", environment: "production" } }));
  await page.goto("/");
  await expectSignedOut(page);
  await expect(page.getByRole("region", { name: "Staging sign-in check" })).toHaveCount(0);
  expect(providerRequests).toBe(0);
});
