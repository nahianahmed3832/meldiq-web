/**
 * Every Meldiq icon, mascot button, launch image and share image comes from the one canonical asset, brand/meldling.png:
 * Meldling, the off-white bear cub on its solid deep-teal square (1254 × 1254, the owner's file, unchanged). Nothing is
 * redrawn: the script crops (keeping Meldling centred with even padding), scales, and for the notification badge only
 * turns the off-white shape into the alpha mask Android badges require. Run after replacing the asset:
 *   node scripts/render-brand-assets.mjs
 */
import { createRequire } from "node:module";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const sharp = createRequire(path.join(root, "package.json"))("sharp");
const source = path.join(root, "brand/meldling.png");
const out = (f) => path.join(root, "public", f);

/** The two colours of the asset (measured: 73% of the pixels are the teal, 27% the off-white). */
export const TEAL = "#045349";
export const CREAM = "#fdfcf9";
/** Padding around Meldling in the tight crops, as a share of its width on each side. */
const TIGHT_PADDING = 0.12;

const { data, info } = await sharp(source).removeAlpha().raw().toBuffer({ resolveWithObject: true });
let [x0, y0, x1, y1] = [info.width, info.height, 0, 0];
for (let y = 0; y < info.height; y++)
  for (let x = 0; x < info.width; x++)
    if (data[(y * info.width + x) * 3] > 200) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
const side = Math.min(info.width, Math.round(Math.max(x1 - x0, y1 - y0) * (1 + 2 * TIGHT_PADDING)));
const clamp = (v) => Math.max(0, Math.min(info.width - side, Math.round(v)));
const tight = { left: clamp((x0 + x1) / 2 - side / 2), top: clamp((y0 + y1) / 2 - side / 2), width: side, height: side };
console.log("Meldling bbox", [x0, y0, x1, y1], "tight crop", tight);

/** "tight": Meldling large in its square (small UI, favicons, app icons); "full": the whole asset (maskable, launch). */
const ASSETS = [
  { file: "favicon-32.png", size: 32, crop: "tight" },
  { file: "meldling-96.webp", size: 96, crop: "tight" },
  { file: "meldling-192.webp", size: 192, crop: "tight" },
  { file: "meldling-128.png", size: 128, crop: "tight" },
  { file: "meldling-256.png", size: 256, crop: "tight" },
  { file: "meldling-180.png", size: 180, crop: "tight" },
  { file: "meldling-192.png", size: 192, crop: "tight" },
  { file: "meldling-512.png", size: 512, crop: "tight" },
  // Maskable icons need the shape inside the central 80% circle: the full asset already has it there.
  { file: "meldling-maskable-512.png", size: 512, crop: "full" },
  { file: "launch/meldling-launch.png", size: 480, crop: "full" },
];

for (const a of ASSETS) {
  let img = sharp(source);
  if (a.crop === "tight") img = img.extract(tight);
  img = img.resize(a.size, a.size, { kernel: "lanczos3" });
  img = a.file.endsWith(".webp") ? img.webp({ quality: 92 }) : img.png({ compressionLevel: 9 });
  await img.toFile(out(a.file));
  console.log(a.file);
}

// The notification badge: Android draws only its alpha, so the off-white shape becomes opaque white, the teal clear.
const badge = await sharp(source).extract(tight).resize(96, 96, { kernel: "lanczos3" }).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true });
const rgba = Buffer.alloc(96 * 96 * 4);
for (let i = 0; i < 96 * 96; i++) {
  // Teal is ~60 in grey, the cream ~252: map that range onto 0–255 alpha, keeping the antialiased edge.
  const alpha = Math.max(0, Math.min(255, Math.round(((badge.data[i] - 60) / (252 - 60)) * 255)));
  rgba.set([255, 255, 255, alpha], i * 4);
}
await sharp(rgba, { raw: { width: 96, height: 96, channels: 4 } })
  .png({ compressionLevel: 9 })
  .toFile(out("meldling-badge-96.png"));
console.log("meldling-badge-96.png");

// The share image: Meldling on its own teal, with the product name (the product is Meldiq; the mascot is Meldling).
const mascot = await sharp(source).extract(tight).resize(400, 400, { kernel: "lanczos3" }).png().toBuffer();
const text = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="660" height="300">
  <text x="0" y="150" font-family="Helvetica, Arial, sans-serif" font-size="112" font-weight="800" fill="${CREAM}" letter-spacing="-3">Meldiq</text>
  <text x="4" y="216" font-family="Helvetica, Arial, sans-serif" font-size="34" fill="${CREAM}" fill-opacity="0.82">End-to-end encrypted community chat</text>
</svg>`);
await sharp({ create: { width: 1200, height: 630, channels: 3, background: TEAL } })
  .composite([
    { input: mascot, left: 70, top: 115 },
    { input: text, left: 500, top: 150 },
  ])
  .png({ compressionLevel: 9 })
  .toFile(out("meldiq-og.png"));
console.log("meldiq-og.png");

/**
 * Browser-tab favicons (continuation brief v3 §6): Meldling's silhouette alone on a transparent ground, no teal
 * square. Each pixel's opacity is how far it is from the teal towards the off-white (so the antialiased edge stays
 * smooth and the teal eyes and mouth become see-through); the colour is one solid tone per variant: deep teal for
 * light browser chrome, white for dark. Cropped close so the shape reads at 16 px.
 */
const SILHOUETTE_PADDING = 0.04;
const sSide = Math.min(info.width, Math.round(Math.max(x1 - x0, y1 - y0) * (1 + 2 * SILHOUETTE_PADDING)));
const sClamp = (v) => Math.max(0, Math.min(info.width - sSide, Math.round(v)));
const sCrop = { left: sClamp((x0 + x1) / 2 - sSide / 2), top: sClamp((y0 + y1) / 2 - sSide / 2), width: sSide, height: sSide };
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const [tr, tg, tb] = hex(TEAL);
const [cr, cg, cb] = hex(CREAM);
const span = Math.hypot(cr - tr, cg - tg, cb - tb);
const cropped = await sharp(source).extract(sCrop).removeAlpha().raw().toBuffer({ resolveWithObject: true });
for (const [variant, colour] of [
  ["light", "#04473e"],
  ["dark", "#ffffff"],
]) {
  const [r, g, b] = hex(colour);
  const px = Buffer.alloc(cropped.info.width * cropped.info.height * 4);
  for (let i = 0; i < cropped.info.width * cropped.info.height; i++) {
    const [pr, pg, pb] = [cropped.data[i * 3], cropped.data[i * 3 + 1], cropped.data[i * 3 + 2]];
    const t = Math.max(0, Math.min(1, Math.hypot(pr - tr, pg - tg, pb - tb) / span));
    px.set([r, g, b, Math.round(255 * t)], i * 4);
  }
  const shape = sharp(px, { raw: { width: cropped.info.width, height: cropped.info.height, channels: 4 } }).png();
  const master = await shape.toBuffer();
  for (const size of [16, 32, 48, 192]) {
    const file = `favicon-${variant}-${size}.png`;
    await sharp(master).resize(size, size, { kernel: "lanczos3" }).png({ compressionLevel: 9 }).toFile(out(file));
    console.log(file);
  }
}
