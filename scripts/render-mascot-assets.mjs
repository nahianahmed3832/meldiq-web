/**
 * The mascot's rail button (Home and messages) from the owner's app icon, brand/reference/app-icon-mascot-wave.webp.
 * Nothing is redrawn: the icon's navy square is cropped inside its glowing edge and scaled. Run after the reference
 * changes: node scripts/render-mascot-assets.mjs
 */
import { createRequire } from "node:module";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const sharp = createRequire(path.join(root, "package.json"))("sharp");
const source = path.join(root, "brand/reference/app-icon-mascot-wave.webp");

/** Inside the rounded square's glow (measured on the 1254 px source: the square spans 60–1183 by 67–1172). */
const CROP = { left: 88, top: 94, width: 1068, height: 1068 };
const SIZES = [96, 192];

for (const size of SIZES) {
  const out = path.join(root, `public/meldiq-mascot-${size}.webp`);
  await sharp(source).extract(CROP).resize(size, size, { kernel: "lanczos3" }).webp({ quality: 90 }).toFile(out);
  console.log(`wrote ${path.relative(root, out)}`);
}
