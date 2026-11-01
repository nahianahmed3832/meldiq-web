import { ApiError, type Credentials } from "../api/client";
import type { AccountSessionGrant } from "../api/accountSchemas";
import { AccountApi } from "./accountApi";
import type { AccountTokens, TokenVault } from "./tokenVault";

/** A stored access token is used after a page load only if it is good for at least this long. */
const STORED_TOKEN_MARGIN_MS = 60_000;

/** Why the account session can't continue without the person: their password is needed, or the account is disabled. */
export type AccountSessionEnd = "session_ended" | "account_disabled";

export function tokensOf(grant: AccountSessionGrant): AccountTokens {
  return {
    accessToken: grant.accessToken,
    accessTokenExpiresAt: grant.accessTokenExpiresAt,
    refreshToken: grant.refreshToken,
    refreshTokenExpiresAt: grant.refreshTokenExpiresAt,
    sessionId: grant.session.id,
  };
}

/**
 * An Orbit 2.0 account session (docs/ORBIT_2_ARCHITECTURE §2). The access token is used for every request and the
 * WebSocket; when the server refuses it, the refresh token is swapped for a new pair, one swap at a time (each swap
 * replaces the refresh token, and sending an old one would end the session). Tokens persist sealed ([TokenVault]).
 */
export class AccountSession implements Credentials {
  private tokens: AccountTokens | null = null;
  private inflight: Promise<boolean> | null = null;
  private suspended = false;
  private readonly accounts: AccountApi;

  constructor(
    base: string,
    private readonly vault: TokenVault,
    private readonly onEnded: (why: AccountSessionEnd) => void,
  ) {
    this.accounts = AccountApi.anonymous(base);
  }

  token(): string | null {
    return this.tokens?.accessToken ?? null;
  }

  get sessionId(): string | null {
    return this.tokens?.sessionId ?? null;
  }

  /** Takes the tokens of a session the server just granted (sign-in, or setting up this browser). */
  async adopt(grant: AccountSessionGrant): Promise<void> {
    this.tokens = tokensOf(grant);
    await this.vault.save(this.tokens);
  }

  /** Forgets the tokens here and in storage. */
  async forget(): Promise<void> {
    this.tokens = null;
    await this.vault.clear();
  }

  /**
   * Whether this browser still holds a session it could renew without the person (tokens whose refresh token hasn't run
   * out): until then nothing kept on this computer is drawn (sync/snapshot.ts), as a locked app shows nothing.
   */
  async restorable(): Promise<boolean> {
    const tokens = this.tokens ?? (await this.vault.load());
    return !!tokens && tokens.refreshTokenExpiresAt > Date.now();
  }

  reauthenticate(): Promise<boolean> {
    if (this.suspended) return Promise.resolve(false);
    this.inflight ??= this.refresh().finally(() => (this.inflight = null));
    return this.inflight;
  }

  /** Finish a rotating refresh before leaving this page, and prevent later responses starting another one. */
  async suspend(): Promise<void> {
    this.suspended = true;
    await this.inflight;
  }

  resume(): void {
    this.suspended = false;
  }

  private async refresh(): Promise<boolean> {
    const before = this.tokens ?? (await this.vault.load());
    if (!before) {
      this.onEnded("session_ended");
      return false;
    }
    const renew = () => this.refreshStored(before);
    // The same account may be open in several tabs. Serialize rotations across those tabs as well as this instance.
    return typeof navigator !== "undefined" && navigator.locks ? navigator.locks.request(`meldiq-session-refresh:${before.sessionId}`, renew) : renew();
  }

  private async refreshStored(before: AccountTokens): Promise<boolean> {
    const current = await this.vault.load();
    if (!current) {
      this.tokens = null;
      this.onEnded("session_ended");
      return false;
    }
    // A tab that rotated while we waited already persisted the new pair; reuse it instead of replaying our old token.
    const updated = !this.tokens || current.refreshToken !== before.refreshToken;
    if (updated && current.accessTokenExpiresAt - Date.now() > STORED_TOKEN_MARGIN_MS) {
      this.tokens = current;
      return true;
    }
    try {
      const grant = await this.accounts.refresh(current.refreshToken);
      await this.adopt(grant);
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        this.tokens = null;
        await this.vault.clear();
        this.onEnded(e.code === "account_disabled" ? "account_disabled" : "session_ended");
      }
      // Offline or the server is busy: keep the tokens and try again later.
      return false;
    }
  }
}
