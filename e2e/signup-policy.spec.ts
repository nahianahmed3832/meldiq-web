import { openPrivacyPolicy } from "./privacy";
import crypto from "node:crypto";
import { expect, test } from "@playwright/test";
import { emailedCode } from "./mail";
import { testAddress } from "./phone";
import { finishWelcome } from "./welcome";

test.use({ serviceWorkers: "block" });

test("signup shows the exact policy revision and requires a new review after a stale submission", async ({ page, context }) => {
  const advertised = await page.request.get("/v2/auth/registration-policy");
  const { policy } = advertised.ok() ? await advertised.json() : { policy: null };
  test.skip(!policy, "requires an explicitly enabled test policy manifest");
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
  const email = `policy.${crypto.randomBytes(6).toString("hex")}@example.test`;
  await page.goto("/");
  await page.getByRole("button", { name: "Create an account", exact: true }).click();
  const checkbox = page.getByRole("checkbox", { name: /I am 13 or older/ });
  await expect(page.getByRole("link", { name: `Terms (${policy.terms.revision})`, exact: true })).toHaveAttribute("href", policy.terms.url);
  await expect(page.getByRole("link", { name: `Privacy (${policy.privacy.revision})`, exact: true })).toHaveAttribute("href", policy.privacy.url);
  await page.getByLabel("Your name", { exact: true }).fill("Policy Signup");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a long password for registration policy qualification");
  let posts = 0;
  await page.route("**/v2/auth/register", async (route) => {
    const body = route.request().postDataJSON();
    posts++;
    expect(body.policyAcceptance).toMatchObject({ termsRevision: policy.terms.revision, privacyRevision: policy.privacy.revision, ageAtLeast13: true });
    await route.continue(posts === 1 ? { postData: JSON.stringify({ ...body, policyAcceptance: { ...body.policyAcceptance, termsRevision: "stale-test-revision" } }) } : {});
  });
  const create = page.getByRole("button", { name: "Create account", exact: true });
  await create.click();
  await expect(page.getByRole("alert")).toContainText(/Terms and Privacy/);
  expect(posts).toBe(0);
  await expect(checkbox).toBeDisabled();
  await openPrivacyPolicy(page);
  await checkbox.check();
  await create.click();
  await expect(page.getByRole("alert")).toContainText(/Review the current Terms/);
  await expect(checkbox).not.toBeChecked();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(email);
  await checkbox.check();
  await create.click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  expect(posts).toBe(2);
  await page.getByLabel("Code", { exact: true }).fill(await emailedCode(email, "verify"));
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("button", { name: "Set up encryption", exact: true }).click();
  await page.getByLabel("I've stored my recovery key somewhere safe.").check();
  await page.getByRole("button", { name: "Open Meldiq", exact: true }).click();
  await finishWelcome(page);
  await expect(page.locator('.app[data-connection="online"]').first()).toBeVisible();
});

test("an operator-provisioned account reviews the advertised policy before first encryption setup", async ({ page, context }, info) => {
  const fixture = process.env.MELDIQ_E2E_OPERATOR_POLICY_PREFIX;
  test.skip(!fixture, "requires a disposable PostgreSQL operator fixture for this browser");
  const advertised = await page.request.get("/v2/auth/registration-policy");
  expect(advertised.ok()).toBe(true);
  const { policy } = await advertised.json();
  expect(policy?.minimumAge).toBe(13);
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
  await page.goto("/");
  await page.getByRole("button", { name: "Continue with email", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(`${fixture}.${info.project.name}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("Synthetic operator activation passphrase");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const setup = page.getByRole("button", { name: "Set up encryption", exact: true });
  const challenge = page.waitForResponse((r) => r.url().endsWith("/v2/account/devices") && r.status() === 409);
  await setup.click();
  await challenge;
  await expect(page.getByRole("link", { name: `Terms (${policy.terms.revision})`, exact: true })).toHaveAttribute("href", policy.terms.url);
  const consent = page.getByRole("checkbox", { name: /I am 13 or older/ });
  await expect(consent).not.toBeChecked();
  await expect(setup).toBeDisabled();
  await expect(consent).toBeDisabled();
  await openPrivacyPolicy(page);
  await consent.check();
  const accepted = page.waitForResponse((r) => r.url().endsWith("/v2/account/devices") && r.ok());
  await setup.click();
  expect((await accepted).request().postDataJSON().policyAcceptance).toEqual({
    termsRevision: policy.terms.revision,
    privacyRevision: policy.privacy.revision,
    ageAtLeast13: true,
    termsAccepted: true,
    privacyAcknowledged: true,
  });
  await page.getByLabel("I've stored my recovery key somewhere safe.").check();
  await page.getByRole("button", { name: "Open Meldiq", exact: true }).click();
  await finishWelcome(page);
  await expect(page.locator('.app[data-connection="online"]').first()).toBeVisible();
});
