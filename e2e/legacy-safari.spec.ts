import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

/**
 * A browser whose WebCrypto has no Ed25519 or X25519, like Safari and iOS before 17 (every iPhone 8, which stops at
 * iOS 16.7). Before the fallback (src/crypto/legacyCurves.ts) Meldiq stopped at "This browser is missing…" there.
 * The two algorithms are taken away before the page loads; everything else is this browser's own. A simulation of that
 * one gap, not Safari 16 itself: docs/MELDIQ_WEB_BROWSERS.md has the device checklist.
 */
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
  await context.addInitScript(() => {
    const subtle = crypto.subtle;
    const curves = /^(ed25519|x25519)$/i;
    const named = (a: unknown) => {
      const n = typeof a === "string" ? a : (a as { name?: unknown } | null)?.name;
      return typeof n === "string" && curves.test(n);
    };
    const refuse = () => Promise.reject(new DOMException("Algorithm: Unrecognized name", "NotSupportedError"));
    const gate = (name: keyof SubtleCrypto, algAt: number) => {
      const original = (subtle[name] as (...a: unknown[]) => Promise<unknown>).bind(subtle);
      Object.defineProperty(subtle, name, { value: (...args: unknown[]) => (named(args[algAt]) ? refuse() : original(...args)), configurable: true, writable: true });
    };
    gate("generateKey", 0);
    gate("importKey", 2);
    gate("sign", 0);
    gate("verify", 0);
    gate("deriveBits", 0);
    gate("unwrapKey", 4);
    (window as unknown as { __noNativeCurves: boolean }).__noNativeCurves = true;
  });
});

test("without Ed25519/X25519 in WebCrypto (iOS 16), Meldiq links, sends and receives, and signs in again after a reload", async ({ page }) => {
  const alice = await newPhone("alice", "Alice Rahman");
  const bob = await newPhone("bob", "Bob Chen");
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id as string;
  await alice.connect();
  await bob.connect();

  // The gap is real on this site: the browser itself refuses the curves (checked on a page the app doesn't run on: an
  // image, which every engine shows rather than downloads, unlike the manifest Firefox saves).
  await page.goto("/favicon-32.png");
  expect(
    await page.evaluate(async () =>
      crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign"]).then(
        () => "native",
        (e: Error) => e.name,
      ),
    ),
  ).toBe("NotSupportedError");

  await link(page, alice);
  await bob.send(dm, { type: "text", text: "Hello iPhone 8" });
  await page
    .getByRole("complementary", { name: "Conversations" })
    .getByRole("link", { name: /Bob Chen/ })
    .click();
  await expect(page.getByText("Hello iPhone 8")).toBeVisible();

  const composer = page.getByLabel("Message Bob Chen");
  await composer.fill("Sent with the fallback curves");
  await composer.press("Enter");
  await expect.poll(() => bob.received.find((m) => m.payload.text === "Sent with the fallback curves")?.senderUserId, { timeout: 10_000 }).toBe(alice.userId);

  // A reload signs in again with the sealed device key, and keeps decrypting.
  await page.reload();
  await expect(page.getByText("Sent with the fallback curves")).toBeVisible({ timeout: 20_000 });
  await bob.send(dm, { type: "text", text: "Still there after the reload?" });
  await expect(page.getByText("Still there after the reload?")).toBeVisible({ timeout: 15_000 });
});
