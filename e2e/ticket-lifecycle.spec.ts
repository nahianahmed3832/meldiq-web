import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

test("a moderator claims, releases, and reopens a private ticket from the desk", async ({ page, context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
  const moderator = await newPhone("ticketmod", "Ticket Moderator");
  const requester = await newPhone("ticketrequest", "Ticket Requester");
  const { org } = await moderator.req("POST", "/v1/orgs", { name: "Ticket Lifecycle Desk" });
  const desk = `/v1/orgs/${org.id}/tickets`;
  await moderator.req("PUT", `${desk}/config`, { enabled: true, maxOpenPerPerson: 2, panels: [] });
  const { invite } = await moderator.req("POST", `/v1/orgs/${org.id}/invites`, { role: "MEMBER", maxUses: 1 });
  await requester.req("POST", "/v1/invites/accept", { code: invite.code });
  const { ticket } = await requester.req("POST", desk, { about: "Private help for a synthetic ticket", notABugReport: true });
  await requester.send(ticket.channelId, { type: "text", text: "The same conversation history must be retained" });
  const ticketPath = `${desk}/${ticket.channelId}`;

  await moderator.connect();
  try {
    await link(page, moderator);
    await page.goto("/workspace/integrations");
    const open = page.getByRole("list", { name: "Open tickets", exact: true });
    await open.getByRole("button", { name: "Claim", exact: true }).click();
    await expect(open.getByText("Assigned to Ticket Moderator")).toBeVisible();
    await open.getByRole("button", { name: "Release claim" }).click();
    await expect(open.getByRole("button", { name: "Claim", exact: true })).toBeEnabled();

    const closedByApi = (await moderator.req("POST", `${ticketPath}/close`)).ticket;
    await page.getByRole("button", { name: "Closed tickets", exact: true }).click();
    const closed = page.getByRole("list", { name: "Closed tickets", exact: true });
    await closed.getByRole("button", { name: "Reopen", exact: true }).click();
    const confirmation = page.getByRole("dialog", { name: "Reopen this ticket?" });
    await expect(confirmation.getByText(/private channel.*conversation history/)).toBeVisible();
    await moderator.req("POST", `${ticketPath}/reopen`, { expectedRevision: closedByApi.revision });
    await moderator.req("POST", `${ticketPath}/close`);
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
    expect((await moderator.req("GET", desk)).tickets[0]).toMatchObject({ channelId: ticket.channelId, closedAt: null });
  } finally {
    await moderator.disconnect();
  }
});
