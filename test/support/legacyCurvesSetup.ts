import { installLegacyCurves } from "../../src/crypto/legacyCurves";

/**
 * ORBIT_LEGACY_CURVES=1 runs the whole suite with the fallback Ed25519/X25519 (what Safari before 17 gets), against the
 * same server, phones and vectors as usual: `ORBIT_LEGACY_CURVES=1 npx vitest run`.
 */
if (process.env.ORBIT_LEGACY_CURVES === "1") await installLegacyCurves(globalThis.crypto, { force: true });
