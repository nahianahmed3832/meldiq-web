import type { AccountSessionGrant } from "../api/accountSchemas";
import { ApiClient, ApiError, type Credentials } from "../api/client";
import { AccountApi } from "./accountApi";

/** Why the setup session can't continue: signed out from another device (or expired), or the account was disabled. */
export type SetupSessionEnd = "session_ended" | "account_disabled";

/**
 * The account session while this browser is being set up (before it has a device record to keep tokens in): held in
 * memory, renewed with its refresh token if setup takes longer than the access token lasts. A page reload during setup
 * means signing in again.
 *
 * The session can be ended from elsewhere meanwhile, typically by removing it on the phone (Settings › Sessions lists it
 * before this browser is a device). The server then refuses both the access and the refresh token; retrying with them can
 * never work, so [onEnded] tells the screen to sign in again instead of failing every attempt that follows.
 */
export class SetupCredentials implements Credentials {
  private inflight: Promise<boolean> | null = null;
  private ended: SetupSessionEnd | null = null;
  readonly accounts: AccountApi;

  constructor(
    private readonly base: string,
    private current: AccountSessionGrant,
    private readonly onEnded: (why: SetupSessionEnd) => void = () => undefined,
  ) {
    this.accounts = new AccountApi(new ApiClient(base, this));
  }

  get grant(): AccountSessionGrant {
    return this.current;
  }

  /** Set once the server has refused this session's refresh token: nothing sent with it will be accepted again. */
  get endedBecause(): SetupSessionEnd | null {
    return this.ended;
  }

  token(): string {
    return this.current.accessToken;
  }

  reauthenticate(): Promise<boolean> {
    if (this.ended) return Promise.resolve(false);
    this.inflight ??= AccountApi.anonymous(this.base)
      .refresh(this.current.refreshToken)
      .then((g) => {
        this.current = g;
        return true;
      })
      .catch((e: unknown) => {
        // 401: the session is over (revoked, expired or the account disabled). Anything else (offline, busy): try later.
        if (e instanceof ApiError && e.status === 401) {
          this.ended = e.code === "account_disabled" ? "account_disabled" : "session_ended";
          this.onEnded(this.ended);
        }
        return false;
      })
      .finally(() => (this.inflight = null));
    return this.inflight;
  }
}
