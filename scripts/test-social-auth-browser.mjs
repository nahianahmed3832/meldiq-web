/** Source-level browser integration tests with a local provider/API double. Never contacts live accounts. */
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import { build } from "esbuild";
import { chromium, webkit, devices, expect } from "@playwright/test";

const bundled = await build({
  stdin: {
    contents: `import React,{useState} from 'react'; import {createRoot} from 'react-dom/client'; import {ApiClient} from './src/api/client'; import {AccountApi} from './src/auth/accountApi'; import {SocialSignIn} from './src/ui/auth/SocialSignIn'; import {SignInForm} from './src/ui/auth/AccountForms'; const api=new ApiClient('',{token:()=> 'test-session',reauthenticate:async()=>false}); const ctx={accounts:new AccountApi(api),deviceName:'Test browser'}; function App(){const [result,setResult]=useState('waiting'); return <>{location.search.includes('link')?<SocialSignIn api={api} mode="link" password="test-password" onLinked={()=>setResult('linked')}/>:<SignInForm ctx={ctx} canSignUp={true} canLinkWithPhone={false} passkeyRpId="localhost" onSignedIn={g=>setResult(g.account.id)} onUnverified={()=>{}} onSignUp={()=>setResult('signup')} onForgot={()=>{}} onLinkWithPhone={()=>{}}/>}<output>{result}</output></>} createRoot(document.getElementById('app')).render(<App/>);`,
    loader: "tsx",
    resolveDir: process.cwd(),
  },
  bundle: true,
  jsx: "automatic",
  write: false,
  platform: "browser",
  format: "esm",
  define: { "process.env.NODE_ENV": '"production"' },
});
const bundle = bundled.outputFiles[0].text;
const hash = (s) => createHash("sha256").update(s).digest("base64url");
let scenario = "login";
const flows = new Map();
const grant = {
  accessToken: "mock-access-token",
  refreshToken: "mock-refresh-token",
  accessTokenExpiresAt: Date.now() + 900_000,
  refreshTokenExpiresAt: Date.now() + 86400_000,
  session: { id: "mock-session", deviceId: null, createdAt: Date.now() },
  account: { id: "same-meldiq-account", email: "mock@example.test", name: "Mock Person", createdAt: 1, legacyLinkedAt: null, selectedWorkspaceId: null, identity: null },
};
let origin;
const isolatedProvider = createServer((req, res) => {
  const url = new URL(req.url, "http://provider.invalid");
  const id = url.searchParams.get("id");
  const f = flows.get(id);
  if (!f) {
    res.writeHead(404);
    return res.end();
  }
  res.setHeader("cross-origin-opener-policy", "same-origin");
  res.setHeader("content-type", "text/html");
  const callback = `${origin}/social-auth-callback.html#${new URLSearchParams({ id, receipt: f.receipt })}`;
  res.end(
    `<!doctype html><h1>Isolated provider</h1><button disabled onclick='location.href=${JSON.stringify(callback)}'>Finish isolated sign-in</button><script>setTimeout(()=>document.querySelector("button").disabled=false,900)</script>`,
  );
});
await new Promise((resolve) => isolatedProvider.listen(0, "127.0.0.1", resolve));
const isolatedOrigin = `http://127.0.0.1:${isolatedProvider.address().port}`;
const server = createServer(async (req, res) => {
  res.setHeader("cache-control", "no-store");
  res.setHeader("cross-origin-opener-policy", "same-origin-allow-popups");
  res.setHeader("content-security-policy", "default-src 'self'; script-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'");
  const url = new URL(req.url, "http://localhost");
  const json = (body, status = 200) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (url.pathname === "/") {
    res.setHeader("content-type", "text/html");
    res.end('<!doctype html><div id="app"></div><script type="module" src="/app.js"></script>');
  } else if (url.pathname === "/app.js") {
    res.setHeader("content-type", "text/javascript");
    res.end(bundle);
  } else if (url.pathname === "/social-auth-callback.html" || url.pathname === "/social-auth-callback.js") {
    res.setHeader("content-type", url.pathname.endsWith(".js") ? "text/javascript" : "text/html");
    res.end(await readFile(`public${url.pathname}`));
  } else if (url.pathname.startsWith("/auth-provider-icons/")) {
    res.setHeader("content-type", "image/svg+xml");
    res.end(await readFile(`public${url.pathname}`));
  } else if (url.pathname === "/v2/auth/login") {
    const data = JSON.parse(await body(req));
    if (scenario === "email-totp" && data.totpCode !== "123456") return json({ error: { code: "totp_required", message: "Enter authenticator code." } }, 401);
    json(grant);
  } else if (url.pathname === "/v2/auth/social/config") json({ providers: ["google", "apple", "discord"], googleClientId: null });
  else if (url.pathname === "/v2/auth/social/start") {
    const data = JSON.parse(await body(req));
    const id = randomBytes(32).toString("base64url");
    flows.set(id, { ...data, scenario, receipt: randomBytes(32).toString("base64url") });
    if (data.mode === "link" && req.headers.authorization !== "Bearer test-session") return json({ error: { code: "unauthorized", message: "Session required" } }, 401);
    json({ id, authorizeUrl: `${origin}/v2/auth/social/authorize/${id}`, expiresAt: Date.now() + 60_000 });
  } else if (url.pathname.startsWith("/v2/auth/social/authorize/")) {
    const id = url.pathname.split("/").at(-1);
    const f = flows.get(id);
    if (f.scenario === "isolated") {
      res.writeHead(302, { location: `${isolatedOrigin}/provider?id=${id}` });
      return res.end();
    }
    if (f.scenario === "cancel") {
      res.setHeader("content-type", "text/html");
      return res.end("Close this test provider window to cancel.");
    }
    res.writeHead(302, { location: `/social-auth-callback.html#${new URLSearchParams({ id, receipt: f.receipt })}` });
    res.end();
  } else if (url.pathname === "/v2/auth/social/complete") {
    const data = JSON.parse(await body(req));
    const f = flows.get(data.id);
    if (!f || f.challenge !== hash(data.verifier) || f.receipt !== data.receipt) return json({ error: { code: "invalid", message: "Invalid test proof" } }, 400);
    if (data.name !== undefined) return json({ error: { code: "unexpected_profile", message: "A social sign-in must not require a manual name." } }, 400);
    if (f.scenario === "invite" && data.inviteCode !== "valid-invite")
      return json({ error: { code: data.inviteCode ? "invalid_invite" : "invite_required", message: data.inviteCode ? "Invalid invitation code." : "Invitation required." } }, 400);
    if (f.scenario === "totp" && data.totpCode !== "123456") return json({ error: { code: "totp_required", message: "Enter authenticator code." } }, 401);
    flows.delete(data.id);
    json(f.mode === "link" ? { linked: true } : { grant });
  } else {
    res.writeHead(404);
    res.end();
  }
});
async function body(req) {
  let result = "";
  for await (const chunk of req) result += chunk;
  return result;
}
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
origin = `http://127.0.0.1:${server.address().port}`;
const results = [];
try {
  for (const [name, browserType, device] of [
    ["Chromium desktop", chromium, null],
    ["Chromium mobile", chromium, devices["Pixel 7"]],
    ["WebKit desktop", webkit, null],
    ["WebKit mobile", webkit, devices["iPhone 13"]],
  ]) {
    let browser;
    try {
      browser = await browserType.launch({ headless: true });
      const context = await browser.newContext(device ?? {});
      const page = await context.newPage();
      for (const testCase of ["options", "email", "email-totp", "email-back", "login", "discord", "profile", "invite", "totp", "link", "isolated", "cancel", "fallback"]) {
        scenario = testCase;
        if (testCase === "fallback")
          await page.addInitScript(() => {
            window.BroadcastChannel = undefined;
          });
        await page.goto(`${origin}/${testCase === "link" ? "?link" : ""}`);
        if (["options", "email", "email-totp", "email-back"].includes(testCase)) {
          await expect(page.getByRole("button", { name: "Sign in with a passkey", exact: true })).toBeVisible();
          await expect(page.getByLabel("Email", { exact: true })).toHaveCount(0);
          if (testCase !== "options") {
            await page.getByRole("button", { name: "Continue with email", exact: true }).click();
            await expect(page.getByRole("heading", { name: "Sign in with email", exact: true })).toBeVisible();
            await expect(page.getByRole("button", { name: "Continue with Google", exact: true })).toHaveCount(0);
            await page.getByLabel("Email", { exact: true }).fill("mock@example.test");
            await page.getByLabel("Password", { exact: true }).fill("test-password");
            if (testCase === "email-back") {
              await page.getByRole("button", { name: "Back", exact: true }).click();
              await expect(page.getByRole("button", { name: "Continue with Google", exact: true })).toBeVisible();
              await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
            } else {
              await page.getByRole("button", { name: "Sign in", exact: true }).click();
              if (testCase === "email-totp") {
                await expect(page.getByRole("heading", { name: "Verify it’s you", exact: true })).toBeVisible();
                await expect(page.getByLabel("Email", { exact: true })).toHaveCount(0);
                await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
                await page.getByLabel("Authenticator or backup code", { exact: true }).fill("123456");
                await page.getByRole("button", { name: "Verify and sign in", exact: true }).click();
              }
              await expect(page.locator("output")).toHaveText("same-meldiq-account");
            }
          }
          results.push({ platform: name, flow: testCase, result: "passed", provider: "local test double" });
          continue;
        }
        const [popup] = await Promise.all([
          page.waitForEvent("popup", { timeout: 60000 }),
          page
            .getByRole("button", { name: `${testCase === "link" ? "Connect" : "Continue with"} ${testCase === "profile" ? "Apple" : testCase === "discord" ? "Discord" : "Google"}`, exact: true })
            .click(),
        ]);
        if (testCase === "cancel") {
          await popup.waitForURL("**/v2/auth/social/authorize/**");
          await popup.close();
          await expect(page.getByRole("button", { name: "Cancel sign-in", exact: true })).toBeVisible();
          await page.getByRole("button", { name: "Cancel sign-in", exact: true }).click();
          await expect(page.getByRole("alert")).toHaveCount(0);
          await expect(page.getByRole("button", { name: "Continue with Google", exact: true })).toBeVisible();
        } else {
          if (testCase === "isolated") {
            await expect(popup.getByRole("heading", { name: "Isolated provider" })).toBeVisible();
            expect(await popup.evaluate(() => window.opener)).toBeNull();
            const isolatedId = new URL(popup.url()).searchParams.get("id");
            await page.evaluate((id) => {
              const ch = new BroadcastChannel(`meldiq-social:${id}`);
              ch.postMessage({ type: "meldiq-social", id: "wrong-flow", receipt: "a".repeat(43) });
              ch.postMessage({ type: "meldiq-social", id, receipt: "invalid-receipt" });
              ch.close();
            }, isolatedId);
            await expect(popup.getByRole("button", { name: "Finish isolated sign-in" })).toBeEnabled();
            expect(await page.evaluate(() => document.querySelector('[role="alert"]')?.textContent ?? null)).toBeNull();
            await popup.getByRole("button", { name: "Finish isolated sign-in" }).click();
          }
          if (["invite", "totp"].includes(testCase)) {
            await expect(page.getByRole("alert")).toHaveCount(0);
            await expect(page.getByLabel("Email", { exact: true })).toHaveCount(0);
            await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
            await expect(page.getByRole("button", { name: "Continue with Google", exact: true })).toHaveCount(0);
          }
          if (testCase === "invite") {
            await expect(page.getByLabel("Display name", { exact: true })).toHaveCount(0);
            await page.getByLabel("Invitation code", { exact: true }).fill("wrong");
            await page.getByRole("button", { name: "Continue", exact: true }).click();
            await expect(page.getByRole("alert")).toHaveText("Invalid invitation code.");
            await page.getByLabel("Invitation code", { exact: true }).fill("valid-invite");
            await page.getByRole("button", { name: "Continue", exact: true }).click();
          }
          await expect(page.getByLabel("Display name", { exact: true })).toHaveCount(0);
          if (testCase === "totp") {
            await page.getByLabel("Authenticator or backup code").fill("123456");
            await page.getByRole("button", { name: "Continue", exact: true }).click();
          }
          await expect(page.locator("output")).toHaveText(testCase === "link" ? "linked" : "same-meldiq-account");
        }
        results.push({ platform: name, flow: testCase, result: "passed", provider: "local test double" });
      }
      const callback = await context.newPage();
      await callback.goto(`${origin}/social-auth-callback.html#id=${"a".repeat(43)}&receipt=${"b".repeat(43)}`);
      await expect(callback.locator("#status")).toContainText("Return to your Meldiq tab");
      expect(new URL(callback.url()).hash).toBe("");
      results.push({ platform: name, flow: "orphan callback clears receipt fragment", result: "passed" });
      await context.close();
    } catch (e) {
      results.push({ platform: name, result: "failed", error: e.message });
      process.exitCode = 1;
    } finally {
      await browser?.close();
    }
  }
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  isolatedProvider.closeAllConnections();
  await new Promise((resolve) => isolatedProvider.close(resolve));
}
await writeFile("/tmp/meldiq-social-browser-results.json", JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
