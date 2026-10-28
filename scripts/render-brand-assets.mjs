/**
 * Every Meldiq icon, mascot image, launch image, share image and illustration comes from the owner's Meldling set
 * (2026-10-29, brand/meldling/: the white bear cub on deep blue and violet). Nothing is redrawn: the script finds each
 * picture's content, crops, masks the app icon's rounded square so its corners are see-through, and scales. For the
 * notification badge and the browser-tab favicons only, the bear's white shape becomes an alpha mask. Run after
 * replacing any of the files:
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

/** The ground the illustrations are drawn on (the art's own deep navy), for the share image and the launch screen. */
export const GROUND = "#070a24";

// ── The app icon: the rounded square found by its content (the corners outside it are black), corners made clear. ──
const iconSource = brand("icon.webp");
const { data, info } = await sharp(iconSource).removeAlpha().raw().toBuffer({ resolveWithObject: true });
let [x0, y0, x1, y1] = [info.width, info.height, 0, 0];
for (let y = 0; y < info.height; y++)
  for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 3;
    if (data[i] + data[i + 1] + data[i + 2] > 60) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
const side = Math.min(x1 - x0, y1 - y0) + 1;
const square = { left: x0, top: y0, width: side, height: side };
const radius = Math.round(side * 0.22);
const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}"><rect width="${side}" height="${side}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`);
const icon = await sharp(iconSource)
  .extract(square)
  .ensureAlpha()
  .composite([{ input: mask, blend: "dest-in" }])
  .png()
  .toBuffer();
console.log("icon square", square, "radius", radius);

const ICONS = [
  { file: "favicon-32.png", size: 32 },
  { file: "meldling-96.webp", size: 96 },
  { file: "meldling-192.webp", size: 192 },
  { file: "meldling-128.png", size: 128 },
  { file: "meldling-256.png", size: 256 },
  { file: "meldling-180.png", size: 180 },
  { file: "meldling-192.png", size: 192 },
  { file: "meldling-512.png", size: 512 },
  { file: "launch/meldling-launch.png", size: 480 },
];
for (const a of ICONS) {
  let img = sharp(icon).resize(a.size, a.size, { kernel: "lanczos3" });
  img = a.file.endsWith(".webp") ? img.webp({ quality: 92 }) : img.png({ compressionLevel: 9 });
  await img.toFile(out(a.file));
  console.log(a.file);
}

// Maskable icons are cut to any shape by the system: the art's own square, without the rounded corners, fills it.
const inner = Math.round(side * 0.06);
await sharp(iconSource)
  .extract({ left: x0 + inner, top: y0 + inner, width: side - 2 * inner, height: side - 2 * inner })
  .resize(512, 512, { kernel: "lanczos3" })
  .png({ compressionLevel: 9 })
  .toFile(out("meldling-maskable-512.png"));
console.log("meldling-maskable-512.png");

// ── The bear's silhouette: its white body against the dark ground, as opacity (badges and favicons). ──
const shapeOf = async (size, colour) => {
  const raw = await sharp(icon).flatten({ background: "#000" }).resize(size, size, { kernel: "lanczos3" }).removeAlpha().raw().toBuffer();
  const px = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    // The cub is near white (its shadows lavender, ~170+); the ground is deep blue (~60 at most): that range is opacity.
    const lum = 0.2126 * raw[i * 3] + 0.7152 * raw[i * 3 + 1] + 0.0722 * raw[i * 3 + 2];
    const alpha = Math.max(0, Math.min(255, Math.round(((lum - 90) / (215 - 90)) * 255)));
    px.set([...colour, alpha], i * 4);
  }
  return sharp(px, { raw: { width: size, height: size, channels: 4 } }).png({ compressionLevel: 9 });
};
await (await shapeOf(96, [255, 255, 255])).toFile(out("meldling-badge-96.png"));
console.log("meldling-badge-96.png");
for (const [variant, colour] of [
  ["light", [42, 28, 120]],
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
