/**
 * Renders the Meldiq icons and share image from public/meldiq.svg with the Chromium Playwright already installs
 * (no image tooling needed). Run after changing the mark:  npx tsx scripts/render-brand-assets.ts
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "..");
const svg = fs.readFileSync(path.join(root, "public/meldiq.svg"), "utf8");
const out = (f: string) => path.join(root, "public", f);

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size, padded] of [
  ["meldiq-180.png", 180, false],
  ["meldiq-192.png", 192, false],
  ["meldiq-512.png", 512, false],
  ["meldiq-maskable-512.png", 512, true],
] as const) {
  await page.setViewportSize({ width: size, height: size });
  // Maskable icons keep the mark inside the 80% safe zone on a full-bleed tile.
  const inner = padded ? `<div style="width:100%;height:100%;background:#0A231C;display:grid;place-items:center"><div style="width:72%;height:72%">${svg}</div></div>` : svg;
  await page.setContent(`<html><body style="margin:0;background:transparent">${inner}<style>svg{width:100%;height:100%;display:block}</style></body></html>`);
  await page.screenshot({ path: out(file), omitBackground: !padded });
  console.log(file);
}
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(`<html><body style="margin:0;width:1200px;height:630px;display:flex;align-items:center;gap:48px;padding:0 96px;box-sizing:border-box;
  background:radial-gradient(900px 500px at 20% -10%,#3a2a26 0%,transparent 60%),#171313;color:#fff8f3;font-family:-apple-system,Helvetica,Arial,sans-serif">
  <div style="width:220px;height:220px;flex-shrink:0">${svg}</div>
  <div><div style="font-size:96px;font-weight:800;letter-spacing:-3px">Meldiq</div>
  <div style="font-size:34px;color:#d9cbc5;margin-top:8px">End-to-end encrypted team messaging</div></div>
  <style>svg{width:100%;height:100%;display:block}</style></body></html>`);
await page.screenshot({ path: out("meldiq-og.png") });
console.log("meldiq-og.png");
await browser.close();
