/**
 * Every Meldiq icon comes from the one canonical logo, brand/meldling.png: Meldling's off-white face on its solid
 * deep-teal square (1254 × 1254, the owner's file, unchanged; the owner, 2026-10-29: the icon stays this one). The
 * mascot images, the share image and the illustrations come from the owner's Meldling set (2026-10-29,
 * brand/meldling/: the white bear cub on deep blue and violet). Nothing is redrawn: the script crops, rounds the app
 * icon's corners, and scales. For the notification badge and the browser-tab favicons only, the face becomes an alpha
 * mask. Run after replacing any of the files:
 *   node scripts/render-brand-assets.mjs
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const sharp = createRequire(path.join(root, "package.json"))("sharp");
const brand = (f) => path.join(root, "brand/meldling", f);
const out = (f) => {
  const p = path.join(root, "public", f);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  return p;
};

/** The logo's two colours: its teal square (also the launch screen's ground) and the face's off-white. */
export const TEAL = "#045349";
export const CREAM = "#fdfcf9";
/** Padding around the face in the icon's square, as a share of the face's width on each side. */
const ICON_PADDING = 0.12;
/** Tighter for the silhouettes, so the face reads at 16 px. */
const SILHOUETTE_PADDING = 0.04;
/** The rounded corners of the app icon, as a share of its side (the brand mark draws the same). */
const CORNER = 0.22;

// ── The app icon: the face large in its teal square, corners made clear. ──
const logo = path.join(root, "brand/meldling.png");
const { data, info } = await sharp(logo).removeAlpha().raw().toBuffer({ resolveWithObject: true });
let [x0, y0, x1, y1] = [info.width, info.height, 0, 0];
for (let y = 0; y < info.height; y++)
  for (let x = 0; x < info.width; x++)
    if (data[(y * info.width + x) * 3] > 200) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
const around = (padding) => {
  const side = Math.min(info.width, Math.round(Math.max(x1 - x0, y1 - y0) * (1 + 2 * padding)));
  const clamp = (v) => Math.max(0, Math.min(info.width - side, Math.round(v)));
  return { left: clamp((x0 + x1) / 2 - side / 2), top: clamp((y0 + y1) / 2 - side / 2), width: side, height: side };
};
const square = around(ICON_PADDING);
const side = square.width;
const radius = Math.round(side * CORNER);
const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}"><rect width="${side}" height="${side}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`);
const icon = await sharp(logo)
  .extract(square)
  .ensureAlpha()
  .composite([{ input: mask, blend: "dest-in" }])
  .png()
  .toBuffer();
console.log("face", [x0, y0, x1, y1], "icon square", square, "radius", radius);

const ICONS = [
  { file: "favicon-32.png", size: 32 },
  { file: "meldling-96.webp", size: 96 },
  { file: "meldling-192.webp", size: 192 },
  { file: "meldling-128.png", size: 128 },
  { file: "meldling-256.png", size: 256 },
  { file: "meldling-180.png", size: 180 },
  { file: "meldling-192.png", size: 192 },
  { file: "meldling-512.png", size: 512 },
];
for (const a of ICONS) {
  let img = sharp(icon).resize(a.size, a.size, { kernel: "lanczos3" });
  img = a.file.endsWith(".webp") ? img.webp({ quality: 92 }) : img.png({ compressionLevel: 9 });
  await img.toFile(out(a.file));
  console.log(a.file);
}

// Maskable icons are cut to any shape by the system, and the launch screen sits on the same teal: the whole logo,
// whose face is already inside the central 80% circle.
for (const [file, size] of [
  ["meldling-maskable-512.png", 512],
  ["launch/meldling-launch.png", 480],
]) {
  await sharp(logo).resize(size, size, { kernel: "lanczos3" }).png({ compressionLevel: 9 }).toFile(out(file));
  console.log(file);
}

// ── The face's silhouette: its off-white against the teal, as opacity (badges and favicons). ──
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const [tr, tg, tb] = hex(TEAL);
const [cr, cg, cb] = hex(CREAM);
const span = Math.hypot(cr - tr, cg - tg, cb - tb);
const shapeOf = async (size, colour) => {
  const raw = await sharp(logo).extract(around(SILHOUETTE_PADDING)).resize(size, size, { kernel: "lanczos3" }).removeAlpha().raw().toBuffer();
  const px = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const t = Math.max(0, Math.min(1, Math.hypot(raw[i * 3] - tr, raw[i * 3 + 1] - tg, raw[i * 3 + 2] - tb) / span));
    px.set([...colour, Math.round(255 * t)], i * 4);
  }
  return sharp(px, { raw: { width: size, height: size, channels: 4 } }).png({ compressionLevel: 9 });
};
await (await shapeOf(96, [255, 255, 255])).toFile(out("meldling-badge-96.png"));
console.log("meldling-badge-96.png");
for (const [variant, colour] of [
  ["light", hex("#04473e")],
  ["dark", [255, 255, 255]],
]) {
  for (const size of [16, 32, 48, 192]) {
    await (await shapeOf(size, colour)).toFile(out(`favicon-${variant}-${size}.png`));
    console.log(`favicon-${variant}-${size}.png`);
  }
}

// ── The share image: the brand banner (Meldling, the name and "Connect. Play. Belong."), cut to 1200 × 630. ──
await sharp(brand("banner.webp")).resize(1200, 630, { fit: "cover", position: "centre" }).png({ compressionLevel: 9 }).toFile(out("meldiq-og.png"));
console.log("meldiq-og.png");

// ── Illustrations: each poster's bear alone (the posters' own words and buttons stay out: the app writes its own). ──
const ILLUSTRATIONS = [
  // [file, source, crop as shares of the source's width and height (left, top, width, height), output width]
  ["meldling/banner.webp", "banner.webp", [0, 0, 1, 1], 1600],
  ["meldling/plus.webp", "plus.webp", [0, 0, 1, 1], 1200],
  ["meldling/spark.webp", "spark.webp", [0, 0, 1, 1], 1200],
  ["meldling/hello.webp", "onboarding-features.webp", [0.05, 0.06, 0.9, 0.46], 640],
  ["meldling/gaming.webp", "onboarding.webp", [0.05, 0.08, 0.9, 0.5], 640],
  ["meldling/all-set.webp", "all-set.webp", [0.08, 0.06, 0.84, 0.55], 640],
  ["meldling/loading.webp", "loading.webp", [0.08, 0.24, 0.84, 0.34], 640],
  ["meldling/waving.webp", "splash.webp", [0.08, 0.15, 0.84, 0.48], 640],
  ["meldling/confused.webp", "confused.webp", [0, 0, 1, 1], 512],
  ["meldling/love.webp", "love.webp", [0, 0, 1, 1], 512],
];
for (const [file, src, [l, t, w, h], width] of ILLUSTRATIONS) {
  const meta = await sharp(brand(src)).metadata();
  const crop = { left: Math.round(l * meta.width), top: Math.round(t * meta.height), width: Math.round(w * meta.width), height: Math.round(h * meta.height) };
  await sharp(brand(src)).extract(crop).resize({ width, kernel: "lanczos3" }).webp({ quality: 86 }).toFile(out(file));
  console.log(file);
}
