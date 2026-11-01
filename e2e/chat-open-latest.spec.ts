import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { expectSignedOut, link } from "./link";
import { newPhone, testAddress } from "./phone";

test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});
const messages = (page: Page) => page.getByRole("log", { name: "Messages" });
async function newest(page: Page, text: string) {
  const list = messages(page);
  await expect(list).toHaveAttribute("aria-busy", "false");
  await expect(list.getByText(text, { exact: true })).toBeVisible();
  await expect.poll(() => list.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight)).toBeLessThan(2);
}
// Exercise the same intercepted links as the sidebar, including when its drawer is closed on phones.
async function go(page: Page, href: string) {
  await page.evaluate((href) => {
    const link = document.createElement("a");
    link.href = href;
    document.body.append(link);
    link.click();
    link.remove();
  }, href);
}

for (const kind of ["dm", "group", "channel"] as const) {
  test(`${kind}: large history opens newest after switching, Back, reload and settings`, async ({ page }) => {
    const alice = await newPhone("latest", "Alice Latest");
    const bob = await newPhone("latestpeer", "Bob Latest");
    let id: string;
    if (kind === "channel") {
      const { org } = await alice.req("POST", "/v1/orgs", { name: "Latest Lab" });
      const { invite } = await alice.req("POST", `/v1/orgs/${org.id}/invites`, { role: "MEMBER" });
      await bob.req("POST", "/v1/invites/accept", { code: invite.code });
      id = (await alice.req("POST", `/v1/orgs/${org.id}/channels`, { name: "latest", scope: "ORG", kind: "PRIVATE", memberIds: [bob.userId] })).channel.id;
    } else {
      if (kind === "group") await bob.req("PUT", "/v1/users/me/messaging", { groupAddPolicy: "everyone" });
      id = (await alice.req("POST", `/v1/conversations/${kind}`, kind === "dm" ? { userId: bob.userId } : { name: "Latest group", memberIds: [bob.userId] })).conversation.id;
    }
    for (let i = 1; i <= 95; i++) await bob.send(id, { type: "text", text: `${kind} line ${i}: ${"History content. ".repeat(10)}` });
    const last = `${kind} line 95: ${"History content. ".repeat(10)}`.trim();
    await link(page, alice);
    const href = `/${kind === "channel" ? "home" : "dms"}/c/${id}`;
    const requests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes(`/v2/conversations/${id}/messages?`)) requests.push(req.url());
    });
    await go(page, href);
    await newest(page, last);
    expect(requests.length).toBeGreaterThan(0);
    expect(requests[0]).not.toMatch(/before=|around=/);
    await expect(messages(page).locator("[id^='msg-']")).toHaveCount(60);
    await expect(messages(page).getByText(`${kind} line 1:`, { exact: false })).toHaveCount(0);
    // Equal millisecond timestamps use message IDs, so send-loop ordinals need not be consecutive in the DOM.
    const initialPage = await alice.req("GET", `/v2/conversations/${id}/messages?limit=60`);
    const ordered = await messages(page)
      .locator("[id^='msg-']")
      .evaluateAll((nodes) => nodes.map((node) => node.id.slice(4)));
    expect(ordered).toEqual(initialPage.messages.map((message: { id: string }) => message.id).reverse());

    // A stale session anchor from the previous release must not control entry or refresh.
    await messages(page).evaluate((el) => {
      el.scrollTop = el.scrollHeight - el.clientHeight - 500;
    });
    await expect(page.getByRole("button", { name: "Jump to latest", exact: true })).toBeVisible();
    await page.evaluate(
      ({ userId, id }) => {
        sessionStorage.setItem("meldiq.readingPositions", JSON.stringify({ [JSON.stringify([userId, id, null])]: { id: "obsolete-anchor", offset: 0, atBottom: false, at: Date.now() } }));
      },
      { userId: alice.userId, id },
    );
    const before = requests.length;
    await go(page, "/home");
    await bob.send(id, { type: "text", text: `${kind} while away` });
    await go(page, href);
    await newest(page, `${kind} while away`);
    expect(requests.length).toBeGreaterThan(before);

    await messages(page).evaluate((el) => {
      el.scrollTop = el.scrollHeight - el.clientHeight - 450;
    });
    await go(page, "/settings/profile");
    await page.goBack();
    await newest(page, `${kind} while away`);
    await messages(page).evaluate((el) => {
      el.scrollTop = el.scrollHeight - el.clientHeight - 450;
    });
    await page.reload();
    await newest(page, `${kind} while away`);

    // A document restored from the browser's back/forward cache is another entry, not an active reader.
    await messages(page).evaluate((el) => {
      el.scrollTop = el.scrollHeight - el.clientHeight - 450;
    });
    const beforeRestore = requests.length;
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    await newest(page, `${kind} while away`);
    await expect.poll(() => requests.length).toBeGreaterThan(beforeRestore);

    // Current content follows arrivals, including the extra height of an image decoding later.
    await bob.send(id, { type: "text", text: `${kind} live at bottom` });
    await newest(page, `${kind} live at bottom`);
    await messages(page).evaluate(async (el) => {
      const image = new Image();
      el.querySelector("[id^='msg-']")!.append(image);
      image.src = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="250"><rect width="240" height="250" fill="blue"/></svg>');
      await image.decode();
    });
    await newest(page, `${kind} live at bottom`);
    if (kind === "dm") {
      await page.locator(".composer input[type=file]").setInputFiles(path.join(import.meta.dirname, "fixtures/photo.jpg"));
      await page.locator(".composer textarea").fill("Latest with a photo attachment");
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await newest(page, "Latest with a photo attachment");
      await expect(messages(page).getByRole("button", { name: /Open image/ })).toBeVisible();
      await page.reload();
      await newest(page, "Latest with a photo attachment");
      await expect(messages(page).getByRole("button", { name: /Open image/ })).toBeVisible();
      await messages(page)
        .getByRole("button", { name: /Open image/ })
        .locator("img")
        .evaluate((image: HTMLImageElement) => image.decode());
      await expect.poll(() => messages(page).evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight)).toBeLessThan(2);
    }
  });
}

test("slow opens cannot expose cached history or acknowledge it; switching cancels the old viewport", async ({ page }) => {
  const alice = await newPhone("slow", "Alice Slow");
  const bob = await newPhone("slowpeer", "Bob Slow");
  const carol = await newPhone("other", "Carol Other");
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id;
  const other = (await alice.req("POST", "/v1/conversations/dm", { userId: carol.userId })).conversation.id;
  for (let i = 1; i <= 70; i++) await bob.send(dm, { type: "text", text: `Slow line ${i} ${"Content. ".repeat(20)}` });
  await carol.send(other, { type: "text", text: "Other latest" });
  await link(page, alice);
  await go(page, `/dms/c/${dm}`);
  await newest(page, `Slow line 70 ${"Content. ".repeat(20)}`.trim());
  await messages(page).evaluate((el) => {
    el.scrollTop = 300;
  });
  await go(page, `/dms/c/${other}`);
  await newest(page, "Other latest");
  await bob.send(dm, { type: "text", text: "Fresh during slow reopening" });
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested = false;
  await page.route(`**/v2/conversations/${dm}/messages?*`, async (route) => {
    requested = true;
    await held;
    await route.continue();
  });
  await go(page, `/dms/c/${dm}`);
  await expect.poll(() => requested).toBe(true);
  // While the initial page is pending there is a loading state, not the first item of an old window.
  await expect(page.locator(".messages[aria-busy=true]")).toBeVisible();
  await expect(messages(page)).toHaveCount(0);
  const summary = await alice.req("GET", "/v2/messages/summary");
  expect(summary.conversations.find((c: { conversationId: string }) => c.conversationId === dm)?.unread).toBeGreaterThan(0);
  await go(page, `/dms/c/${other}`);
  await newest(page, "Other latest");
  release();
  await page.unrouteAll({ behavior: "wait" });
  await newest(page, "Other latest");
  await go(page, `/dms/c/${dm}`);
  await newest(page, "Fresh during slow reopening");
});

test("signing out and linking again opens large server history at latest", async ({ page }) => {
  const alice = await newPhone("return", "Alice Return");
  const bob = await newPhone("returnpeer", "Bob Return");
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id;
  for (let i = 1; i <= 75; i++) await bob.send(dm, { type: "text", text: `Return line ${i} ${"Content. ".repeat(15)}` });
  await link(page, alice);
  await go(page, `/dms/c/${dm}`);
  await newest(page, `Return line 75 ${"Content. ".repeat(15)}`.trim());
  await messages(page).evaluate((el) => {
    el.scrollTop = 300;
  });
  await go(page, "/settings/security");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("dialog", { name: "Sign out of this browser?" }).getByRole("button", { name: "Sign out", exact: true }).click();
  await expectSignedOut(page);
  await bob.send(dm, { type: "text", text: "Newest after sign out" });
  await link(page, alice);
  await go(page, `/dms/c/${dm}`);
  await newest(page, "Newest after sign out");
});
