/**
 * The PostCSS plugin entry Next.js loads by path (postcss.config.mjs): build/lightDarkFallback.ts with this project's
 * PostCSS. Node runs the TypeScript file directly (type stripping, Node 22.18+). Loaded through a require made at run
 * time from the project's folder: the build bundles this file, and a plain relative require would be resolved from there.
 */
const { createRequire } = require("node:module");
const path = require("node:path");

const load = createRequire(path.join(process.cwd(), "package.json"));
const postcss = load("postcss");
const { lightDarkFallback } = load("./build/lightDarkFallback.ts");

module.exports = () => lightDarkFallback(postcss);
module.exports.postcss = true;
