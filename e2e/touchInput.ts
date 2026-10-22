import type { Locator, Page } from "@playwright/test";

/** A finger held on [target] for [ms] (a long press), optionally sliding [dy] pixels (a scroll). */
export async function hold(page: Page, target: Locator, ms: number, dy = 0): Promise<void> {
  const box = (await target.boundingBox())!;
  const x = box.x + Math.min(40, box.width / 2);
  const y = box.y + box.height / 2;
  const ev = { pointerType: "touch", isPrimary: true, pointerId: 7, bubbles: true };
  await target.dispatchEvent("pointerdown", { ...ev, clientX: x, clientY: y });
  if (dy) await target.dispatchEvent("pointermove", { ...ev, clientX: x, clientY: y + dy });
  await page.waitForTimeout(ms);
  await target.dispatchEvent("pointerup", { ...ev, clientX: x, clientY: y + dy });
}
