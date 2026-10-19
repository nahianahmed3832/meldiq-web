import type { LegacyTicket } from "../api/accountSchemas";
import { canonical } from "../crypto/canonical";
import { sign, signingKeyFromSeed } from "../crypto/ed25519";
import { decodeRecoveryCode } from "../crypto/recoveryCode";
import type { AccountApi } from "./accountApi";
import { SetupError } from "./deviceSetup";

/**
 * Step 1 of moving an account from before Orbit 2.0 to email sign-in (docs/ORBIT_2_ARCHITECTURE §5): proves this browser
 * holds the account's identity key by signing a fresh challenge with the key derived from the recovery key. The recovery
 * key itself never leaves the browser. Returns the single-use ticket and the seed (kept to set up this browser after).
 */
export async function verifyLegacyAccount(accounts: AccountApi, username: string, recoveryCode: string): Promise<{ ticket: LegacyTicket; seed: Uint8Array }> {
  const seed = await decodeRecoveryCode(recoveryCode);
  if (!seed) throw new SetupError("That recovery key isn't complete or has a typo. Check it and try again.");
  const name = username.trim().replace(/^@/, "").toLowerCase();
  try {
    const nonce = await accounts.challenge();
    const signature = await sign(await signingKeyFromSeed(seed), canonical.legacyMigration(name, nonce));
    return { ticket: await accounts.legacyVerify(name, nonce, signature), seed };
  } catch (e) {
    seed.fill(0);
    throw e;
  }
}
