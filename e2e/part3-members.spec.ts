import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";
test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ context }) => context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() }));
test("member pages preserve loaded selections on failure, exclude owners and atomically save only the reviewed role targets", async ({ page }) => {
  const owner = await newPhone("pagedowner", "Directory Owner");
  const org = (await owner.req("POST", "/v1/orgs", { name: "Member pages" })).org.id;
  const invite = (await owner.req("POST", `/v1/orgs/${org}/invites`, { role: "MEMBER", maxUses: 60 })).invite.code;
  for (let i = 0; i < 51; i++) {
    const member = await newPhone(`pagedmember${i}`, `Paged Member ${String(i).padStart(2, "0")}`);
    await member.req("POST", "/v1/invites/accept", { code: invite });
  }
  const role = (await owner.req("POST", `/v1/orgs/${org}/roles`, { name: "Selected members", permissions: [] })).role;
  await link(page, owner);
  await page.goto("/workspace/people");
  await expect(page.getByText("0 selected · 50 loaded · 52 matches", { exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Select Directory Owner", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Select loaded members", exact: true }).click();
  await expect(page.getByText("49 selected · 50 loaded · 52 matches", { exact: true })).toBeVisible();
  await page.route(`**/v1/orgs/${org}/members?**`, async (route) => {
    if (new URL(route.request().url()).searchParams.has("after"))
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "unavailable", message: "Fixture directory outage" } }) });
    else await route.continue();
  });
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Fixture directory outage" })).toBeVisible();
  await expect(page.getByText("49 selected · 50 loaded · 52 matches", { exact: true })).toBeVisible();
  await page.unroute(`**/v1/orgs/${org}/members?**`);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByText("49 selected · 52 loaded · 52 matches", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Select loaded members", exact: true }).click();
  await expect(page.getByText("50 selected · 52 loaded · 52 matches", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Manage selected roles", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Manage selected roles", exact: true });
  await dialog.getByRole("combobox", { name: "Role", exact: true }).selectOption(role.id);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await owner.req("GET", `/v1/roles/${role.id}/members`)).members).toHaveLength(0);
  await page.getByRole("button", { name: "Manage selected roles", exact: true }).click();
  await dialog.getByRole("combobox", { name: "Role", exact: true }).selectOption(role.id);
  await page.route(
    `**/v1/roles/${role.id}/members/bulk`,
    (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "unavailable", message: "Fixture role outage" } }) }),
    { times: 1 },
  );
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByRole("combobox", { name: "Role", exact: true })).toHaveValue(role.id);
  expect((await owner.req("GET", `/v1/roles/${role.id}/members`)).members).toHaveLength(0);
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect((await owner.req("GET", `/v1/roles/${role.id}/members`)).members).toHaveLength(50);
  await page.reload();
  await expect(page.getByText("0 selected · 50 loaded · 52 matches", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Search people", exact: true }).fill("Paged Member 50");
  await page.getByRole("textbox", { name: "Search people", exact: true }).press("Enter");
  await expect(page.getByText("0 selected · 1 loaded · 1 matches", { exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Select Paged Member 50", exact: true })).toBeVisible();
});
