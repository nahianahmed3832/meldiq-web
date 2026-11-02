import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import crypto from "node:crypto";
import { emailedCode } from "./mail";
import { newPhone, testAddress } from "./phone";

test.use({ serviceWorkers: "block", actionTimeout: 20_000 });
test.setTimeout(180_000);
// WebKit reports aborted same-origin fetches as page errors while an old document unloads.
// Keep runtime errors strict; exclude only that browser diagnostic during an explicit navigation.
function watchErrors(page: Page) {
  const errors: { message: string; at: number }[] = [];
  const navigations: { start: number; end: number }[] = [];
  page.on("pageerror", (e) => errors.push({ message: e.message, at: Date.now() }));
  return {
    navigate: async (run: () => Promise<unknown>) => {
      const span = { start: Date.now(), end: Infinity };
      navigations.push(span);
      try {
        await run();
      } finally {
        span.end = Date.now() + 100;
      }
    },
    unexpected: () =>
      errors
        .filter((e) => !(e.message.startsWith("/127.0.0.1:") && e.message.endsWith("due to access control checks.") && navigations.some((n) => e.at >= n.start && e.at <= n.end)))
        .map((e) => e.message),
  };
}

async function onboard(page: Page, context: BrowserContext) {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
  // Use normal email onboarding against the exact production export, without development device linking.
  let authorization = "";
  page.on("request", (request) => {
    authorization = request.headers()["authorization"] || authorization;
  });
  const email = `identity.${crypto.randomBytes(6).toString("hex")}@example.test`;
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Create an account", exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Create an account", exact: true }).click();
  await page.getByLabel("Your name", { exact: true }).fill("Zoya Rahman");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a long enough password for identity verification");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.getByLabel("Code", { exact: true }).fill(await emailedCode(email, "verify"));
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("button", { name: "Set up encryption", exact: true }).click();
  await page.getByLabel("I've stored my recovery key somewhere safe.").check();
  await page.getByRole("button", { name: "Open Meldiq", exact: true }).click();
  await expect(page.locator('.app[data-connection="online"]').first()).toBeVisible();
  const req = async (method: string, path: string, data?: Record<string, unknown>) => {
    expect(authorization).toMatch(/^Bearer /);
    const response = await page.request.fetch(`${process.env.ORBIT_E2E_API}${path}`, {
      method,
      headers: { authorization, "x-forwarded-for": testAddress() },
      ...(data ? { data } : {}),
    });
    expect(response.ok(), `${method} ${path}: ${response.status()}`).toBe(true);
    return response.json();
  };
  return { userId: (await req("GET", "/v1/users/me")).user.id as string, req };
}

test("poll percentages, named and hidden ballots survive reload, change, remove and close", async ({ page, context }, info) => {
  const runtime = watchErrors(page);
  const owner = await onboard(page, context);
  const named = await newPhone("pollpublic", "Mina Public");
  const hidden = await newPhone("pollhidden", "Secret Person");
  const { org } = await owner.req("POST", "/v1/orgs", { name: "Community Nights" });
  const { invite } = await owner.req("POST", `/v1/orgs/${org.id}/invites`, { role: "MEMBER", maxUses: 2 });
  for (const peer of [named, hidden]) await peer.req("POST", "/v1/invites/accept", { code: invite.code });
  const conversations = (await owner.req("GET", "/v1/conversations")).conversations as { id: string; orgId: string; name: string }[];
  const channel = conversations.find((c) => c.orgId === org.id && c.name === "general")!;
  for (const peer of [named, hidden]) await peer.req("POST", `/v1/conversations/${channel.id}/join`).catch(() => undefined);
  await runtime.navigate(() => page.goto(`/home/c/${channel.id}`));
  await page.locator(".composer-file-button").click();
  await page.getByRole("menuitem", { name: "Poll…", exact: true }).click();
  const create = page.getByRole("dialog", { name: "New poll", exact: true });
  await create.getByLabel("Question", { exact: true }).fill("What should we do on Friday?");
  await create.getByLabel("Option 1", { exact: true }).fill("Game night");
  await create.getByLabel("Option 2", { exact: true }).fill("Game night");
  await expect(create.getByRole("button", { name: "Send poll" })).toBeDisabled();
  await expect(create.getByRole("alert")).toHaveText("Each answer must be different.");
  await create.getByLabel("Option 2", { exact: true }).fill("Movie night");
  await create.getByLabel("Close voting").selectOption("60");
  await create.getByRole("switch", { name: "Allow several answers" }).click();
  await create.getByRole("button", { name: "Send poll" }).click();
  const poll = page.getByRole("group", { name: "Poll: What should we do on Friday?", exact: true });
  await expect(poll).toContainText("Ends in 1h");
  const target = (await poll.locator("xpath=ancestor::*[starts-with(@id,'msg-')][1]").getAttribute("id"))!.slice(4);
  await named.send(channel.id, { type: "vote", target, choices: ["o1"], anonymous: false }, "control");
  await hidden.send(channel.id, { type: "vote", target, choices: ["o1", "o2"], anonymous: true }, "control");
  await expect(poll).toContainText("2 people voted");
  await expect(poll.getByRole("checkbox", { name: "Game night, 2 votes, 100% of voters", exact: true })).toBeVisible();
  await expect(poll.getByRole("checkbox", { name: "Movie night, 1 vote, 50% of voters", exact: true })).toBeVisible();
  await poll.getByRole("button", { name: "View votes" }).click();
  const results = page.getByRole("dialog", { name: "Poll votes", exact: true });
  await expect(results.locator(".poll-voter")).toHaveCount(2);
  await expect(results).toContainText("Mina Public");
  await expect(results).toContainText("Anonymous voter");
  await expect(results).not.toContainText("Secret Person");
  expect(await results.innerHTML()).not.toContain(hidden.userId);
  await expect(results.locator(".anonymous img")).toHaveCount(0);
  await results.getByLabel("Show voters for").selectOption("o2");
  await expect(results.locator(".poll-voter")).toHaveCount(1);
  await expect(results.locator(".poll-voter")).toContainText("Anonymous voter");
  await results.getByRole("button", { name: "Done", exact: true }).click();
  await poll.getByRole("switch", { name: "Vote anonymously" }).click();
  await poll.getByRole("checkbox", { name: /^Movie night,/ }).click();
  await expect(poll).toContainText("3 people voted");
  await runtime.navigate(() => page.reload());
  await expect(poll).toContainText("3 people voted");
  await expect(poll.getByRole("switch", { name: "Vote anonymously" })).toHaveAttribute("aria-checked", "true");
  await poll.getByRole("button", { name: "View votes" }).click();
  await expect(results.locator(".anonymous")).toHaveCount(2);
  await expect(results).not.toContainText("Zoya Rahman");
  await results.screenshot({ path: info.outputPath("poll-voters.png") });
  await results.getByRole("button", { name: "Done", exact: true }).click();
  await poll.getByRole("switch", { name: "Vote anonymously" }).click();
  await poll.getByRole("button", { name: "View votes" }).click();
  await expect(results).toContainText("Zoya Rahman");
  await expect(results.locator(".anonymous")).toHaveCount(1);
  await results.getByRole("button", { name: "Done", exact: true }).click();
  await poll.getByRole("button", { name: "Remove my vote", exact: true }).click();
  await expect(poll).toContainText("2 people voted");
  await poll.screenshot({ path: info.outputPath("poll-card.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(poll).toBeVisible();
  expect(await poll.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await poll.screenshot({ path: info.outputPath("poll-phone.png") });
  await page.setViewportSize({ width: 1440, height: 900 });
  await poll.getByRole("button", { name: "Close poll", exact: true }).click();
  await page.getByRole("dialog", { name: "Close this poll?" }).getByRole("button", { name: "Close poll", exact: true }).click();
  await expect(poll.getByRole("checkbox").first()).toBeDisabled();
  await expect(poll).toContainText("Voting closed");
  await runtime.navigate(() => page.reload());
  await expect(poll).toContainText("Voting closed");
  await owner.req("POST", "/v2/messages", {
    conversationId: channel.id,
    messageId: crypto.randomUUID(),
    cls: "message",
    sentAt: Date.now(),
    payload: {
      type: "text",
      text: "Timed poll",
      poll: {
        question: "Quick decision",
        options: [
          { id: "a", text: "Yes" },
          { id: "b", text: "No" },
        ],
        multi: false,
        endsAt: Date.now() + 6000,
      },
    },
  });
  await runtime.navigate(() => page.reload());
  const timed = page.getByRole("group", { name: "Poll: Quick decision", exact: true });
  await expect(timed).toBeVisible();
  await expect(timed.getByRole("radio").first()).toBeEnabled();
  await expect(timed.getByRole("radio").first()).toBeDisabled();
  await expect(timed).toContainText("Voting closed");
  expect(runtime.unexpected()).toEqual([]);
});

test("long originals fit completely, zoom and pan, and navigate across separate image messages", async ({ page, context }, info) => {
  const runtime = watchErrors(page);
  const owner = await onboard(page, context);
  const peer = await newPhone("imagepeer", "Image Friend");
  const dm = (await owner.req("POST", "/v1/conversations/dm", { userId: peer.userId })).conversation.id as string;
  await runtime.navigate(() => page.goto(`/dms/c/${dm}`));
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 6000;
    const ctx = canvas.getContext("2d")!;
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i % 2 ? "#f4edc8" : "#d9e6c3";
      ctx.fillRect(0, i * 600, 600, 600);
      ctx.fillStyle = "#252b20";
      ctx.font = "32px sans-serif";
      ctx.fillText(`Section ${i + 1} of 10`, 40, i * 600 + 80);
    }
    return canvas.toDataURL("image/png").split(",")[1];
  });
  const upload = page.locator(".composer input[type=file]");
  await upload.setInputFiles({ name: "long-original.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open image long-original.png", exact: true })).toBeVisible();
  await upload.setInputFiles("e2e/fixtures/photo.jpg");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Open image photo/ })).toBeVisible();
  const opener = page.getByRole("button", { name: "Open image long-original.png", exact: true });
  await opener.click();
  const viewer = page.locator(".media-viewer");
  const image = viewer.locator(".viewer-original");
  const canvas = viewer.locator(".viewer-image-viewport");
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((im: HTMLImageElement) => [im.naturalWidth, im.naturalHeight])).toEqual([600, 6000]);
  const fits = await image.evaluate((im) => {
    const box = im.getBoundingClientRect(),
      canvas = im.closest(".viewer-image-viewport")!.getBoundingClientRect();
    return { ratio: box.height / box.width, fits: box.height <= canvas.height + 1 && box.width <= canvas.width + 1 };
  });
  expect(fits.ratio).toBeCloseTo(10, 1);
  expect(fits.fits).toBe(true);
  await expect(viewer.locator(".viewer-position")).toContainText("1 / 2");
  await expect(viewer.getByRole("button", { name: /^Previous/ })).toBeDisabled();
  await viewer.getByRole("button", { name: "Fit image width", exact: true }).click();
  await expect.poll(() => canvas.evaluate((el) => el.scrollHeight / el.clientHeight)).toBeGreaterThan(3);
  await canvas.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect.poll(() => canvas.evaluate((el) => el.scrollTop)).toBeGreaterThan(1000);
  await viewer.screenshot({ path: info.outputPath("long-image-full-width.png") });
  await viewer.getByRole("button", { name: "Fit image", exact: true }).click();
  await viewer.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect.poll(() => canvas.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  const before = await canvas.evaluate((el) => el.scrollTop);
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 80, { steps: 5 });
  await page.mouse.up();
  expect(await canvas.evaluate((el) => el.scrollTop)).toBeGreaterThan(before);
  await viewer.getByRole("button", { name: /^Next/ }).click();
  await expect(viewer.locator(".viewer-position")).toContainText("2 / 2");
  await expect(viewer.getByRole("button", { name: /^Next/ })).toBeDisabled();
  await expect(image).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(viewer.locator(".viewer-position")).toContainText("long-original.png");
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((im: HTMLImageElement) => im.naturalHeight)).toBe(6000);
  await page.keyboard.press("1");
  await expect(viewer.getByLabel("Zoom level")).toHaveText("100%");
  await page.keyboard.press("0");
  await page.setViewportSize({ width: 390, height: 844 });
  await viewer.getByRole("button", { name: "Fit image width", exact: true }).click();
  expect(await viewer.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await expect(viewer.getByRole("button", { name: /^Next/ })).toBeVisible();
  await expect(viewer.getByRole("button", { name: "Zoom in", exact: true })).toBeVisible();
  await expect
    .poll(() =>
      image.evaluate((im) => {
        const r = im.getBoundingClientRect(),
          v = im.closest(".viewer-image-viewport")!.getBoundingClientRect();
        return Math.max(0, Math.min(r.bottom, v.bottom) - Math.max(r.top, v.top));
      }),
    )
    .toBeGreaterThan(100);
  await info.attach("phone-image-metrics.json", {
    body: JSON.stringify(
      await image.evaluate((im) => ({
        image: im.getBoundingClientRect().toJSON(),
        viewport: im.closest(".viewer-image-viewport")!.getBoundingClientRect().toJSON(),
        visibility: getComputedStyle(im).visibility,
      })),
    ),
    contentType: "application/json",
  });
  await viewer.screenshot({ path: info.outputPath("image-viewer-phone.png") });
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);
  await expect(opener).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 900 });
  await runtime.navigate(() => page.goto(`/dms/c/${dm}/details`));
  const details = page.getByRole("complementary", { name: "Details", exact: true });
  await details.getByRole("tab", { name: /^Media/ }).click();
  await expect(details.locator(".gallery-cell")).toHaveCount(2);
  await details.getByRole("button", { name: "Open image long-original.png", exact: true }).click();
  await expect(viewer.locator(".viewer-position")).toContainText("2 / 2");
  await viewer.getByRole("button", { name: "Previous image", exact: true }).click();
  await expect(viewer.locator(".viewer-position")).toContainText("1 / 2");
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);
  expect(runtime.unexpected()).toEqual([]);
});
