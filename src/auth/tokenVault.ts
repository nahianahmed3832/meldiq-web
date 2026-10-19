import { copy, fromUtf8, randomBytes, utf8 } from "../crypto/bytes";
import type { LocalStore } from "../store/db";

/** The account session's tokens. The refresh token is a long-lived credential; the access token lasts 15 minutes. */
export interface AccountTokens {
  accessToken: string;
  accessTokenExpiresAt: number;
  refreshToken: string;
  refreshTokenExpiresAt: number;
  sessionId: string;
}

interface SealedTokens {
  iv: Uint8Array;
  data: Uint8Array;
}

const KEY = "accountTokenKey";
const TOKENS = "accountTokens";

/**
 * Keeps the account session's tokens across page loads (android IdentityStore seals them with a Keystore key). They are
 * AES-256-GCM encrypted with a non-extractable key that lives in this browser's IndexedDB, so the stored bytes are useless
 * copied off the disk alone; script running in the page could still use them (docs/ORBIT_WEB_STATUS.md › Security).
 * Signing out erases the database, key and tokens included.
 */
export class TokenVault {
  constructor(private readonly store: LocalStore) {}

  private async key(): Promise<CryptoKey> {
    const existing = await this.store.getValue<CryptoKey>(KEY);
    if (existing instanceof CryptoKey) return existing;
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    await this.store.setValue(KEY, key);
    return key;
  }

  async save(tokens: AccountTokens): Promise<void> {
    const iv = randomBytes(12);
    const data = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await this.key(), utf8(JSON.stringify(tokens))));
    await this.store.setValue(TOKENS, { iv, data } satisfies SealedTokens);
  }

  async load(): Promise<AccountTokens | null> {
    const sealed = await this.store.getValue<SealedTokens>(TOKENS);
    if (!sealed) return null;
    try {
      const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: copy(sealed.iv) }, await this.key(), copy(sealed.data));
      return JSON.parse(fromUtf8(new Uint8Array(plain))) as AccountTokens;
    } catch {
      return null;
    }
  }

  async clear(): Promise<void> {
    await this.store.deleteValue(TOKENS);
  }
}
