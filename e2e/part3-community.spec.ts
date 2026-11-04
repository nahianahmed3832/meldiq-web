import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";
test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ context }) => context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() }));
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
test("external event locations and occurrence or series changes are explicit and survive reload", async ({ page }) => {
  const owner = await newPhone("eventscope", "Event Scope Owner");
  const org = (await owner.req("POST", "/v1/orgs", { name: "Event scope browser" })).org.id;
  const channel = (await owner.req("POST", `/v1/orgs/${org}/channels`, { name: "event-visibility", scope: "ORG" })).channel.id;
  const event = (
    await owner.req("POST", `/v1/orgs/${org}/meetings`, {
      roomId: channel,
      externalLocation: "Conference hall <literal text>",
      title: "Weekly gathering",
      startsAt: Date.now() + 3600000,
      endsAt: Date.now() + 7200000,
      timeZone: "UTC",
      repeat: "weekly",
    })
  ).meeting;
  await link(page, owner);
  await page.goto("/workspace/meetings");
  await expect(page.getByText(/Conference hall <literal text>/)).toBeVisible();
  await page.getByRole("button", { name: "Edit Weekly gathering", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "Edit event", exact: true });
  await expect(edit.getByRole("combobox", { name: "Apply change to", exact: true })).toHaveValue("occurrence");
  await expect(edit.getByRole("combobox", { name: "Repeats", exact: true })).toBeDisabled();
  await edit.getByRole("textbox", { name: "Title", exact: true }).fill("Special gathering");
  await edit.getByRole("button", { name: "Save", exact: true }).click();
  await expect(edit).toHaveCount(0);
  expect((await owner.req("GET", `/v1/meetings/${event.id}`)).meeting.occurrenceOverride).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "Edit Special gathering", exact: true }).click();
  await edit.getByRole("combobox", { name: "Apply change to", exact: true }).selectOption("series");
  await expect(edit.getByRole("combobox", { name: "Repeats", exact: true })).toBeEnabled();
  await edit.getByRole("textbox", { name: "Title", exact: true }).fill("Series gathering");
  await edit.getByRole("button", { name: "Save", exact: true }).click();
  await expect(edit).toHaveCount(0);
  expect((await owner.req("GET", `/v1/meetings/${event.id}`)).meeting.occurrenceOverride).toBe(false);
  await page.getByRole("button", { name: "Cancel Series gathering", exact: true }).click();
  const cancel = page.getByRole("dialog", { name: "Cancel event", exact: true });
  await expect(cancel.getByRole("combobox", { name: "Apply change to", exact: true })).toHaveValue("occurrence");
  await cancel.getByRole("button", { name: "Confirm cancellation", exact: true }).click();
  await expect(cancel).toHaveCount(0);
  expect((await owner.req("GET", `/v1/meetings/${event.id}`)).meeting.cancelled).toBe(true);
});
test("event covers save, survive reload, retain the selection after failure and can be removed", async ({ page }) => {
  const owner = await newPhone("coverowner", "Cover Owner");
  const org = (await owner.req("POST", "/v1/orgs", { name: "Cover fixture" })).org.id;
  const room = (await owner.req("POST", `/v1/orgs/${org}/channels`, { name: "cover-room", voice: true, scope: "ORG" })).channel.id;
  const meeting = (await owner.req("POST", `/v1/orgs/${org}/meetings`, { roomId: room, title: "Cover event", startsAt: Date.now() + 3600000, endsAt: Date.now() + 7200000, timeZone: "UTC" })).meeting;
  await link(page, owner);
  await page.goto("/workspace/meetings");
  await page.getByRole("button", { name: "Event cover: Cover event", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Event cover", exact: true });
  await dialog.getByLabel("Event cover", { exact: true }).setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: png });
  await expect(dialog.getByRole("img", { name: "Event cover: Cover event", exact: true })).toBeVisible();
  let failed = true;
  await page.route("**/v1/meetings/*/cover?*", async (route) => {
    if (failed && route.request().method() === "PUT")
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "storage_unavailable", message: "Fixture image outage" } }) });
    else await route.continue();
  });
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  expect(await dialog.getByLabel("Event cover", { exact: true }).evaluate((e: HTMLInputElement) => e.files?.length)).toBe(1);
  failed = false;
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const image = page.getByRole("img", { name: "Event cover: Cover event", exact: true });
  await expect(image).toBeVisible();
  expect(await image.evaluate((e: HTMLImageElement) => e.naturalWidth)).toBeGreaterThan(0);
  await page.reload();
  await expect(image).toBeVisible();
  expect((await owner.req("GET", `/v1/meetings/${meeting.id}`)).meeting.coverId).toBeTruthy();
  await page.getByRole("button", { name: "Event cover: Cover event", exact: true }).click();
  await dialog.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(image).toHaveCount(0);
  expect((await owner.req("GET", `/v1/meetings/${meeting.id}`)).meeting.coverId).toBeNull();
});
test("a role selects a validated community emoji and keeps the draft after a failed save", async ({ page }) => {
  const owner = await newPhone("assetowner", "Asset Owner");
  const org = (await owner.req("POST", "/v1/orgs", { name: "Role fixture" })).org.id;
  const asset = (await owner.req("POST", `/v1/orgs/${org}/expressions?kind=emoji&name=lime`, undefined, png)).expression;
  const role = (await owner.req("POST", `/v1/orgs/${org}/roles`, { name: "Asset role", permissions: [] })).role;
  await link(page, owner);
  await page.goto("/workspace/roles");
  await page.getByText("Asset role", { exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit role - Asset role", exact: true });
  await dialog.getByLabel("Role icon", { exact: true }).selectOption(asset.id);
  await expect(dialog.getByRole("img", { name: ":lime:", exact: true })).toBeVisible();
  let failed = true;
  await page.route("**/v1/roles/*/extras", async (route) => {
    if (failed && route.request().method() === "PUT")
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "unavailable", message: "Fixture role outage" } }) });
    else await route.continue();
  });
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByLabel("Role icon", { exact: true })).toHaveValue(asset.id);
  failed = false;
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect((await owner.req("GET", `/v1/orgs/${org}/roles`)).roles.find((r: any) => r.id === role.id).extras.iconExpressionId).toBe(asset.id);
  await page.reload();
  await page.getByText("Asset role", { exact: true }).click();
  await expect(dialog.getByLabel("Role icon", { exact: true })).toHaveValue(asset.id);
});
test("a whole-community report goes to Meldiq operators and retries return the same receipt", async ({ page }) => {
  const owner = await newPhone("reportowner", "Report Owner");
  const org = (await owner.req("POST", "/v1/orgs", { name: "Report fixture" })).org.id;
  await link(page, owner);
  await page.goto("/workspace/overview");
  await page.getByRole("button", { name: "Report Report fixture", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Report Report fixture", exact: true });
  await dialog.getByRole("button", { name: "Spam", exact: true }).click();
  await expect(dialog).toContainText("Goes to Meldiq's team");
  await dialog.getByLabel("Add details (optional)").fill("Private report fixture");
  await dialog.getByRole("button", { name: "Send report", exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText("Report sent to Meldiq's team");
  const first = (await owner.req("POST", `/v1/orgs/${org}/report`, { reason: "spam" })).report;
  const again = (await owner.req("POST", `/v1/orgs/${org}/report`, { reason: "spam" })).report;
  expect(first.repeated).toBe(true);
  expect(again.id).toBe(first.id);
  expect((await owner.req("GET", `/v1/orgs/${org}/reports`)).reports).toEqual([]);
});
test("a voice room's associated text chat does not join audio and keeps text permissions independent", async ({ page }) => {
  const owner = await newPhone("voiceowner", "Voice Owner"),
    member = await newPhone("voicemember", "Voice Member");
  const org = (await owner.req("POST", "/v1/orgs", { name: "Voice text fixture" })).org.id;
  const code = (await owner.req("POST", `/v1/orgs/${org}/invites`, { role: "MEMBER" })).invite.code;
  await member.req("POST", "/v1/invites/accept", { code });
  const room = (await owner.req("POST", `/v1/orgs/${org}/channels`, { name: "room-chat", voice: true, scope: "ORG" })).channel.id;
  await owner.req("PUT", `/v1/conversations/${room}/overwrites`, { subject: `user:${member.userId}`, allow: [], deny: ["voice.connect"] });
  let callRequests = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && /\/v1\/calls(?:$|\/)/.test(new URL(request.url()).pathname)) callRequests++;
  });
  await page.addInitScript(() => {
    (window as any).__roomMediaRequests = 0;
    const original = navigator.mediaDevices?.getUserMedia.bind(navigator.mediaDevices);
    if (original)
      navigator.mediaDevices.getUserMedia = (...args) => {
        (window as any).__roomMediaRequests++;
        return original(...args);
      };
  });
  await link(page, member);
  await page.goto(`/home/c/${room}`);
  await expect(page.getByRole("button", { name: "Join voice", exact: true })).toBeDisabled();
  await expect(page.getByPlaceholder(/^Message /)).toHaveCount(0);
  const modes = page.getByRole("group", { name: "Room chat", exact: true });
  await modes.getByRole("button", { name: "Room chat", exact: true }).click();
  const composer = page.getByPlaceholder(/^Message /);
  await composer.fill("Associated text without audio");
  await composer.press("Enter");
  await expect(page.locator(".msg").filter({ hasText: "Associated text without audio" })).toBeVisible();
  await modes.getByRole("button", { name: "Voice room", exact: true }).click();
  await expect(composer).toHaveCount(0);
  await modes.getByRole("button", { name: "Room chat", exact: true }).click();
  await expect(page.locator(".msg").filter({ hasText: "Associated text without audio" })).toBeVisible();
  expect(callRequests).toBe(0);
  expect(await page.evaluate(() => (window as any).__roomMediaRequests)).toBe(0);
});
test("the private partner application validates its checklist and retains its draft after a failed submission", async ({ page }) => {
  const owner = await newPhone("partnerowner", "Partner Owner");
  const org = (await owner.req("POST", "/v1/orgs", { name: "Partner fixture" })).org.id;
  await link(page, owner);
  await page.goto("/workspace/overview");
  const card = page.getByRole("region", { name: "Partner application", exact: true });
  await expect(card).toContainText("approval grants no badge");
  const statement = card.getByRole("textbox", { name: "Tell us about your community", exact: true });
  await statement.fill("A private application with <b>literal markup</b>");
  const send = card.getByRole("button", { name: "Send it in", exact: true });
  await expect(send).toBeDisabled();
  for (const label of ["Published community guidelines", "Moderation coverage", "Safety and reporting process", "Active community"])
    await card.getByRole("checkbox", { name: label, exact: true }).check();
  let failed = true;
  await page.route("**/partner-application", async (route) => {
    if (failed && route.request().method() === "PUT")
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "unavailable", message: "Fixture review queue outage" } }) });
    else await route.continue();
  });
  await send.click();
  await expect(card.getByRole("alert")).toBeVisible();
  await expect(statement).toHaveValue("A private application with <b>literal markup</b>");
  await expect(card.getByRole("checkbox", { name: "Active community", exact: true })).toBeChecked();
  failed = false;
  await send.click();
  await expect(card.getByRole("status")).toHaveText("Pending");
  const saved = (await owner.req("GET", `/v1/orgs/${org}/partner-application`)).application;
  expect(saved).toMatchObject({ status: "submitted", rev: 1, statement: "A private application with <b>literal markup</b>" });
  await page.reload();
  await expect(statement).toHaveValue(saved.statement);
  await expect(send).toBeDisabled();
});
test("authorized audit entries expand administrative changes and omit private descriptions", async ({ page }) => {
  const owner = await newPhone("auditowner", "Audit Owner");
  const org = (await owner.req("POST", "/v1/orgs", { name: "Audit fixture" })).org.id;
  const role = (await owner.req("POST", `/v1/orgs/${org}/roles`, { name: "Audit role", permissions: [] })).role;
  await owner.req("PATCH", `/v1/roles/${role.id}`, { baseRev: role.rev, color: "#A3E635", permissions: ["messages.post"], description: "PRIVATE_DESCRIPTION" });
  await link(page, owner);
  await page.goto("/workspace/audit");
  const entry = page.getByRole("listitem").filter({ hasText: "role update" }).filter({ hasText: "Audit role" });
  await entry.getByText("Changes", { exact: true }).click();
  await expect(entry).toContainText('Before: null → After: "#A3E635"');
  await expect(entry).toContainText("Permission grants");
  await expect(entry).not.toContainText("PRIVATE_DESCRIPTION");
  await entry.getByText("Changes", { exact: true }).press("Enter");
  await expect(entry.getByText("Permission grants", { exact: true })).not.toBeVisible();
});
test("forum paging, activity sort and gallery keep their scope through retries and show an authorized post image", async ({ page }) => {
  const owner = await newPhone("forumowner", "Forum Owner");
  const org = (await owner.req("POST", "/v1/orgs", { name: "Forum gallery fixture" })).org.id;
  const cid = (await owner.req("POST", `/v1/orgs/${org}/channels`, { name: "gallery-forum", format: "forum", scope: "ORG" })).channel.id;
  const root = `root_${owner.username}_old`;
  await owner.send(cid, { type: "text", text: "Oldest post\n\nHistorical body", title: "Oldest post" }, "message", root);
  for (let i = 0; i < 60; i++) await owner.send(cid, { type: "text", text: `Recent post ${i}`, title: `Recent post ${i}` });
  await owner.send(cid, { type: "text", text: "New reply to old post", threadRoot: root });
  let requests = 0;
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith("/message-collections") && url.searchParams.get("kind") === "forum") requests++;
  });
  await link(page, owner);
  await page.goto(`/home/c/${cid}`);
  const forum = page.locator(".forum"),
    posts = forum.getByRole("list", { name: "Posts", exact: true });
  await expect(posts.locator(":scope > li")).toHaveCount(50);
  await expect(posts.locator(":scope > li").first()).toContainText("Oldest post");
  const layout = forum.getByRole("group", { name: "Post layout", exact: true });
  const beforeLayout = requests;
  await layout.getByRole("button", { name: "Gallery", exact: true }).click();
  await expect(posts).toHaveClass(/is-gallery/);
  await expect(posts.locator(":scope > li")).toHaveCount(50);
  expect(requests).toBe(beforeLayout);
  let failed = true;
  await page.route("**/message-collections?**", async (route) => {
    const q = new URL(route.request().url()).searchParams;
    if (failed && q.get("kind") === "forum" && q.has("before"))
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "unavailable", message: "Fixture forum paging outage" } }) });
    else await route.continue();
  });
  await forum.getByRole("button", { name: "More", exact: true }).click();
  await expect(forum.getByRole("alert")).toBeVisible();
  await expect(posts.locator(":scope > li")).toHaveCount(50);
  failed = false;
  await forum.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(posts.locator(":scope > li")).toHaveCount(61);
  await forum.getByLabel("Sort posts").selectOption("newest");
  await expect(posts.locator(":scope > li")).toHaveCount(50);
  await expect(posts.locator(":scope > li").first()).not.toContainText("Oldest post");
  await forum.getByRole("textbox", { name: "Search posts", exact: true }).fill("Oldest post");
  await expect(posts.locator(":scope > li")).toHaveCount(1);
  await expect(posts).toContainText("Oldest post");
  await forum.getByRole("textbox", { name: "Search posts", exact: true }).fill("");
  await forum.getByRole("button", { name: "New post", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New post in #gallery-forum", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox", { name: "Title", exact: true }).fill("Picture post");
  await dialog.getByRole("textbox", { name: "Post", exact: true }).fill("Authorized gallery attachment");
  await dialog.getByLabel("Upload", { exact: true }).setInputFiles({ name: "picture.png", mimeType: "image/png", buffer: png });
  await dialog.getByRole("button", { name: "Post", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto(`/home/c/${cid}`);
  await forum.getByRole("group", { name: "Post layout", exact: true }).getByRole("button", { name: "Gallery", exact: true }).click();
  const picture = posts.locator(":scope > li").filter({ hasText: "Picture post" });
  await expect(picture).toBeVisible();
  const load = picture.getByRole("button", { name: /^Load photo/ });
  if (await load.count()) await load.click();
  await expect(picture.getByRole("img", { name: /picture/ })).toBeVisible();
});
test("forum tag requirements persist and ordinary authors cannot select moderator-only tags", async ({ page, browser, baseURL }) => {
  const owner = await newPhone("tagowner", "Tag Owner"),
    member = await newPhone("tagmember", "Tag Member");
  const org = (await owner.req("POST", "/v1/orgs", { name: "Tag policy fixture" })).org.id;
  const code = (await owner.req("POST", `/v1/orgs/${org}/invites`, { role: "MEMBER" })).invite.code;
  await member.req("POST", "/v1/invites/accept", { code });
  const cid = (await owner.req("POST", `/v1/orgs/${org}/channels`, { name: "tag-forum", format: "forum", scope: "ORG" })).channel.id;
  await owner.req("PATCH", `/v1/conversations/${cid}`, { forumTags: [{ name: "General" }, { name: "Staff" }] });
  await link(page, owner);
  await page.goto(`/home/c/${cid}/details`);
  const details = page.getByRole("complementary", { name: "Details", exact: true });
  await details.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("complementary", { name: "Channel settings", exact: true }).getByRole("button", { name: "Edit channel", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "Edit #tag-forum", exact: true });
  await edit.getByRole("checkbox", { name: "Require a tag for new posts", exact: true }).check();
  await edit.getByRole("checkbox", { name: "Moderators only: Staff", exact: true }).check();
  await edit.getByRole("button", { name: "Save", exact: true }).click();
  await expect(edit).toHaveCount(0);
  const configured = (await owner.req("GET", `/v1/conversations/${cid}`)).conversation;
  expect(configured.requireForumTag).toBe(true);
  expect(configured.forumTags.find((t: any) => t.name === "Staff").restricted).toBe(true);
  const recipientContext = await browser.newContext({
    baseURL,
    viewport: page.viewportSize(),
    serviceWorkers: "block",
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: "meldiq.introSeen", value: "1" }] }] },
  });
  try {
    await recipientContext.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
    const author = await recipientContext.newPage();
    await link(author, member);
    await author.goto(`/home/c/${cid}`);
    await author.getByRole("button", { name: "New post", exact: true }).click();
    const post = author.getByRole("dialog", { name: "New post in #tag-forum", exact: true });
    await post.getByRole("textbox", { name: "Title", exact: true }).fill("Required-tag post");
    await expect(post.getByRole("button", { name: "Staff", exact: true })).toBeDisabled();
    await post.getByRole("button", { name: "Post", exact: true }).click();
    await expect(post.getByRole("alert")).toHaveText("Choose at least one tag.");
    await post.getByRole("button", { name: "General", exact: true }).click();
    await post.getByRole("button", { name: "Post", exact: true }).click();
    await expect(post).toHaveCount(0);
    await author.goto(`/home/c/${cid}`);
    await expect(author.locator(".forum-posts")).toContainText("Required-tag post");
  } finally {
    await recipientContext.close();
  }
});
