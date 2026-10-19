/**
 * Every Meldiq icon and share image is derived from the one authoritative logo, brand/meldiq-logo.webp (2000×2000, the
 * mark on its own navy ground). Nothing is redrawn: the script only crops (keeping the mark centred with even padding)
 * and scales, with the Chromium Playwright already installs. Run after replacing the logo:
 *   npx tsx scripts/render-brand-assets.ts
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "..");
const source = `data:image/webp;base64,${fs.readFileSync(path.join(root, "brand/meldiq-logo.webp")).toString("base64")}`;
const out = (f: string) => path.join(root, "public", f);

/** Square crops: "tight" frames the mark with 14% padding (in-app marks, favicons, platform icons); "full" is the whole logo. */
const TIGHT_PADDING = 0.14;
const ASSETS: { file: string; size: number; crop: "tight" | "full" }[] = [
  { file: "meldiq-mark-128.png", size: 128, crop: "tight" },
  { file: "meldiq-mark-256.png", size: 256, crop: "tight" },
  { file: "favicon-32.png", size: 32, crop: "tight" },
  { file: "meldiq-180.png", size: 180, crop: "tight" },
  { file: "meldiq-192.png", size: 192, crop: "tight" },
  { file: "meldiq-512.png", size: 512, crop: "tight" },
  // Maskable icons need the mark inside the central 80% circle: the full logo already has it there.
  { file: "meldiq-maskable-512.png", size: 512, crop: "full" },
];

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent("<html><body></body></html>");

const rendered = await page.evaluate(
  async ({ source, assets, padding }) => {
    const img = new Image();
    img.src = source;
    await img.decode();
    const n = img.naturalWidth;
    const probe = document.createElement("canvas");
    probe.width = probe.height = n;
    const pc = probe.getContext("2d")!;
    pc.drawImage(img, 0, 0);
    const px = pc.getImageData(0, 0, n, n).data;
    // The mark's extent: the bright ribbon (any channel over 120); the navy ground and its glow stay well below.
    let x0 = n,
      y0 = n,
      x1 = 0,
      y1 = 0;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const i = (y * n + x) * 4;
        if (Math.max(px[i], px[i + 1], px[i + 2]) > 120) {
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
      }
    const side = Math.min(n, Math.max(x1 - x0, y1 - y0) * (1 + 2 * padding));
    const cx = (x0 + x1) / 2,
      cy = (y0 + y1) / 2;
    const tight = { sx: Math.max(0, Math.min(n - side, cx - side / 2)), sy: Math.max(0, Math.min(n - side, cy - side / 2)), side };
    const corner = Array.from(px.slice(0, 3));
    const files: Record<string, string> = {};
    for (const a of assets) {
      const c = document.createElement("canvas");
      c.width = c.height = a.size;
      const ctx = c.getContext("2d")!;
      ctx.imageSmoothingQuality = "high";
      const r = a.crop === "tight" ? tight : { sx: 0, sy: 0, side: n };
      ctx.drawImage(img, r.sx, r.sy, r.side, r.side, 0, 0, a.size, a.size);
      files[a.file] = c.toDataURL("image/png");
    }
    return { files, bbox: [x0, y0, x1, y1], tight, corner };
  },
  { source, assets: ASSETS, padding: TIGHT_PADDING },
);
for (const [file, url] of Object.entries(rendered.files)) {
  fs.writeFileSync(out(file), Buffer.from(url.split(",")[1], "base64"));
  console.log(file);
}
console.log("mark bbox", rendered.bbox, "ground", rendered.corner);

// The share image: the full logo on its own ground colour (its edges feathered into it), with the name.
const ground = `rgb(${rendered.corner.join(",")})`;
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(`<html><body style="margin:0;width:1200px;height:630px;display:flex;align-items:center;gap:40px;padding:0 88px;box-sizing:border-box;
  background:${ground};color:#f5f3ff;font-family:-apple-system,Helvetica,Arial,sans-serif">
  <img src="${source}" style="width:420px;height:420px;flex-shrink:0;margin-left:-40px;-webkit-mask-image:radial-gradient(closest-side,#000 72%,transparent 100%);mask-image:radial-gradient(closest-side,#000 72%,transparent 100%)">
  <div><div style="font-size:104px;font-weight:800;letter-spacing:-3px">Meldiq</div>
  <div style="font-size:34px;color:#c4c8f0;margin-top:8px">End-to-end encrypted team messaging</div></div></body></html>`);
await page.screenshot({ path: out("meldiq-og.png") });
console.log("meldiq-og.png");
await browser.close();
