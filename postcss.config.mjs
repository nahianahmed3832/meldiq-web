import { fileURLToPath } from "node:url";

/**
 * PostCSS for the Next.js build: the colour fallback for browsers without light-dark() (build/lightDarkFallback.ts).
 * By absolute path: the build loads plugins from its own folder, not this one.
 */
const lightDark = fileURLToPath(new URL("./build/postcss-light-dark.cjs", import.meta.url));

export default { plugins: { [lightDark]: {} } };
