/**
 * Build facts, inlined by Next.js (next.config.mjs `env`, and NODE_ENV): a development build exposes test hooks
 * (window.__orbit, used by the browser tests); production builds never do.
 */
export const DEV = process.env.NODE_ENV !== "production";

/** The web app's version (package.json), matching the Android release it corresponds to. */
export const APP_VERSION = process.env.MELDIQ_APP_VERSION ?? "development";
