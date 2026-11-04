import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";
test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ context }) => context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() }));
test("quiz answers stay hidden until close and anonymous votes never expose their account in another member's response", async ({ page, browser, baseURL }) => {
  const owner = await newPhone("quizbrowserowner", "Quiz Owner"),
    peer = await newPhone("quizbrowserpeer", "Private Quiz Voter");
  const org = (await owner.req("POST", "/v1/orgs", { name: "Quiz browser" })).org.id;
  const code = (await owner.req("POST", `/v1/orgs/${org}/invites`, { role: "MEMBER" })).invite.code;
  await peer.req("POST", "/v1/invites/accept", { code });
  const cid = (await owner.req("POST", `/v1/orgs/${org}/channels`, { name: "quiz-room", scope: "ORG" })).channel.id;
  await link(page, owner);
  await page.goto(`/home/c/${cid}`);
  await page.locator(".composer-file-button").click();
  await page.getByRole("menuitem", { name: "Poll…", exact: true }).click();
  const create = page.getByRole("dialog", { name: "New poll", exact: true });
  await create.getByRole("textbox", { name: "Question", exact: true }).fill("Which number is even?");
  await create.getByRole("textbox", { name: "Option 1", exact: true }).fill("Three");
  await create.getByRole("textbox", { name: "Option 2", exact: true }).fill("Four");
  await create.getByRole("switch", { name: "Quiz", exact: true }).click();
  await expect(create.getByRole("button", { name: "Send poll", exact: true })).toBeDisabled();
  await create.getByRole("checkbox", { name: "Correct answer: Option 2", exact: true }).check();
  await create.getByRole("button", { name: "Send poll", exact: true }).click();
  await expect(create).toHaveCount(0);
  const poll = page.getByRole("group", { name: "Poll: Which number is even?", exact: true });
  await expect(poll).toContainText("Correct answers are revealed after voting closes.");
  await expect(poll.getByText("Correct answer", { exact: true })).toHaveCount(0);
  const id = (await poll.locator("xpath=ancestor::*[starts-with(@id,'msg-')][1]").getAttribute("id"))!.slice(4);
  const context = await browser.newContext({
    baseURL,
    viewport: page.viewportSize(),
    serviceWorkers: "block",
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: "meldiq.introSeen", value: "1" }] }] },
  });
  try {
    await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
    const voter = await context.newPage();
    await link(voter, peer);
    await voter.goto(`/home/c/${cid}`);
    const other = voter.getByRole("group", { name: "Poll: Which number is even?", exact: true });
    await other.getByRole("switch", { name: "Vote anonymously", exact: true }).click();
    await voter.route(
      `**/v1/polls/${id}/vote`,
      (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "unavailable", message: "Fixture ballot outage" } }) }),
      { times: 1 },
    );
    await other.getByRole("radio", { name: /^Four,/ }).click();
    await expect(other.getByRole("alert")).toBeVisible();
    await expect(other.getByRole("switch", { name: "Vote anonymously", exact: true })).toHaveAttribute("aria-checked", "true");
    await other.getByRole("radio", { name: /^Four,/ }).click();
    await expect(poll).toContainText("1 person voted");
    await expect(other.getByText("Correct answer", { exact: true })).toHaveCount(0);
    const before = await owner.req("GET", `/v1/polls/${id}`);
    expect(before.correctOptionIds).toBeNull();
    expect(JSON.stringify(before)).not.toContain(peer.userId);
    const history = await peer.req("GET", `/v2/conversations/${cid}/messages`);
    expect(history.messages.find((m: any) => m.id === id).payload.managedPoll).not.toHaveProperty("correctOptionIds");
    await poll.getByRole("button", { name: "View votes", exact: true }).click();
    const votes = page.getByRole("dialog", { name: "Poll votes", exact: true });
    await expect(votes).toContainText("Anonymous voter");
    await expect(votes).not.toContainText("Private Quiz Voter");
    expect(await votes.innerHTML()).not.toContain(peer.userId);
    await votes.getByRole("button", { name: "Done", exact: true }).click();
    await poll.getByRole("button", { name: "Close poll", exact: true }).click();
    await page.getByRole("dialog", { name: "Close this poll?", exact: true }).getByRole("button", { name: "Close poll", exact: true }).click();
    await expect(poll.getByText("Correct answer", { exact: true })).toBeVisible();
    await expect(other.getByText("Correct answer", { exact: true })).toBeVisible();
    await expect(other.getByRole("radio", { name: /^Four,/ })).toBeDisabled();
    await voter.reload();
    await expect(other.getByText("Correct answer", { exact: true })).toBeVisible();
    expect((await peer.req("GET", `/v1/polls/${id}`)).correctOptionIds).toEqual(["o2"]);
  } finally {
    await context.close();
  }
});
