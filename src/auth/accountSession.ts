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

  reauthenticate(): Promise<boolean> {
    this.inflight ??= this.refresh().finally(() => (this.inflight = null));
    return this.inflight;
  }

  private async refresh(): Promise<boolean> {
    let current = this.tokens;
    if (!current) {
      // First use after a page load: the stored access token, if it still has a while to run, saves a swap.
      current = await this.vault.load();
      if (current && current.accessTokenExpiresAt - Date.now() > STORED_TOKEN_MARGIN_MS) {
        this.tokens = current;
        return true;
      }
    }
    if (!current) {
      this.onEnded("session_ended");
      return false;
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
