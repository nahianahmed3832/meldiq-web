import type { AccountSessionGrant } from "../api/accountSchemas";
import { ApiClient, type Credentials } from "../api/client";
import { AccountApi } from "./accountApi";

/**
 * The account session while this browser is being set up (before it has a device record to keep tokens in): held in
 * memory, renewed with its refresh token if setup takes longer than the access token lasts. A page reload during setup
 * means signing in again.
 */
export class SetupCredentials implements Credentials {
  private inflight: Promise<boolean> | null = null;
  readonly accounts: AccountApi;

  constructor(
    private readonly base: string,
    private current: AccountSessionGrant,
  ) {
    this.accounts = new AccountApi(new ApiClient(base, this));
  }

  get grant(): AccountSessionGrant {
    return this.current;
  }

  token(): string {
    return this.current.accessToken;
  }

  reauthenticate(): Promise<boolean> {
    this.inflight ??= AccountApi.anonymous(this.base)
      .refresh(this.current.refreshToken)
      .then((g) => {
        this.current = g;
        return true;
      })
      .catch(() => false)
      .finally(() => (this.inflight = null));
    return this.inflight;
  }
}
