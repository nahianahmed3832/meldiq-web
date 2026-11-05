import crypto from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { emailedCode } from "./mail";
import { newPhone, testAddress } from "./phone";
import { finishWelcome } from "./welcome";

test.use({ serviceWorkers: "block" });
test.setTimeout(120_000);

async function signUpModerator(page: Page) {
  const email = `ticket.${crypto.randomBytes(6).toString("hex")}@example.test`;
  await page.goto("/");
  await page.getByRole("button", { name: "Create an account", exact: true }).click();
  await page.getByLabel("Your name", { exact: true }).fill("Ticket Moderator");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a long enough password for ticket qualification");
  await page.getByLabel("I am 13 or older. I agree to the Terms and acknowledge the Privacy.", { exact: true }).check();
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.getByLabel("Code", { exact: true }).fill(await emailedCode(email, "verify"));
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  const [enroll] = await Promise.all([
    page.waitForRequest((request) => request.method() === "POST" && new URL(request.url()).pathname === "/v2/account/devices"),
    page.getByRole("button", { name: "Set up encryption", exact: true }).click(),
  ]);
  await page.getByLabel("I've stored my recovery key somewhere safe.").check();
  await page.getByRole("button", { name: "Open Meldiq", exact: true }).click();
  await finishWelcome(page);
  await expect(page.locator('.app[data-connection="online"]').first()).toBeVisible();
  const authorization = await enroll.headerValue("authorization");
  if (!authorization) throw new Error("The synthetic moderator did not receive an authenticated session");
  return async (method: string, url: string, body?: unknown) => {
    const response = await page.request.fetch(url, { method, headers: { authorization }, ...(body !== undefined ? { data: body } : {}) });
    expect(response.ok(), `${method} ${url}: ${response.status()}`).toBe(true);
    return response.json();
  };
}

test("a moderator claims, releases, and reopens a private ticket from the desk", async ({ page, context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
  const moderator = await signUpModerator(page);
  const requester = await newPhone("ticketrequest", "Ticket Requester");
  const { org } = await moderator("POST", "/v1/orgs", { name: "Ticket Lifecycle Desk" });
  const desk = `/v1/orgs/${org.id}/tickets`;
  await moderator("PUT", `${desk}/config`, { enabled: true, maxOpenPerPerson: 2, panels: [] });
  const { invite } = await moderator("POST", `/v1/orgs/${org.id}/invites`, { role: "MEMBER", maxUses: 1 });
  await requester.req("POST", "/v1/invites/accept", { code: invite.code });
  const { ticket } = await requester.req("POST", desk, { about: "Private help for a synthetic ticket", notABugReport: true });
  await requester.send(ticket.channelId, { type: "text", text: "The same conversation history must be retained" });
  const ticketPath = `${desk}/${ticket.channelId}`;

  await page.goto("/workspace/integrations");
  const open = page.getByRole("list", { name: "Open tickets", exact: true });
  await open.getByRole("button", { name: "Claim", exact: true }).click();
  await expect(open.getByText("Assigned to Ticket Moderator")).toBeVisible();
  await open.getByRole("button", { name: "Release claim" }).click();
  await expect(open.getByRole("button", { name: "Claim", exact: true })).toBeEnabled();

  const closedByApi = (await moderator("POST", `${ticketPath}/close`)).ticket;
  await page.getByRole("button", { name: "Closed tickets", exact: true }).click();
  const closed = page.getByRole("list", { name: "Closed tickets", exact: true });
  await closed.getByRole("button", { name: "Reopen", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "Reopen this ticket?" });
  await expect(confirmation.getByText(/private channel.*conversation history/)).toBeVisible();
  await moderator("POST", `${ticketPath}/reopen`, { expectedRevision: closedByApi.revision });
  await moderator("POST", `${ticketPath}/close`);
  await confirmation.getByRole("button", { name: "Reopen", exact: true }).click();
  await expect(confirmation.getByRole("alert")).toContainText(/changed/i);
  await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();

  await closed.getByRole("button", { name: "Reopen", exact: true }).click();
  await confirmation.getByRole("button", { name: "Reopen", exact: true }).click();
  await expect(confirmation).not.toBeVisible();
  await expect(page.getByText("No closed tickets.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open tickets", exact: true }).click();
  await open.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.getByText("The same conversation history must be retained", { exact: true })).toBeVisible();
  expect((await moderator("GET", desk)).tickets[0]).toMatchObject({ channelId: ticket.channelId, closedAt: null });
});
