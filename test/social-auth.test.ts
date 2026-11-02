import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountSession } from "../src/auth/accountSession";
import type { AccountTokens, TokenVault } from "../src/auth/tokenVault";
import { socialChallenge } from "../src/auth/socialAuth";
import type { AccountSessionGrant } from "../src/api/accountSchemas";
afterEach(() => {
  vi.unstubAllGlobals();
});
const grant = (token: string): AccountSessionGrant => ({
  accessToken: `access-${token}`,
  accessTokenExpiresAt: Date.now() + 900_000,
  refreshToken: token,
  refreshTokenExpiresAt: Date.now() + 999_999,
  session: { id: "shared-session", deviceId: "device", createdAt: 1 },
  account: { id: "account", email: "person@example.test", name: "Person", createdAt: 1, legacyLinkedAt: null, selectedWorkspaceId: null, identity: null },
});
describe("social sessions reuse existing Meldiq session security", () => {
  it("uses the S256 PKCE proof challenge", async () => {
    expect(await socialChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
  it("serializes refresh across tabs and adopts the rotated pair", async () => {
    let stored: AccountTokens | null = null;
    const vault = {
      save: async (v: AccountTokens) => {
        stored = v;
      },
      load: async () => stored,
      clear: async () => {
        stored = null;
      },
    } as TokenVault;
    let lock: Promise<unknown> = Promise.resolve();
    vi.stubGlobal("navigator", {
      locks: {
        request: (_key: string, fn: () => Promise<unknown>) => {
          const result = lock.then(fn);
          lock = result.catch(() => undefined);
          return result;
        },
      },
    });
    const refresh = vi.fn(async () => Response.json(grant("next-token")));
    vi.stubGlobal("fetch", refresh);
    const a = new AccountSession("", vault, vi.fn());
    const b = new AccountSession("", vault, vi.fn());
    await a.adopt(grant("old-token"));
    await b.adopt(grant("old-token"));
    expect(await Promise.all([a.reauthenticate(), b.reauthenticate()])).toEqual([true, true]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(a.token()).toBe(b.token());
    expect(stored).toMatchObject({ accessToken: "access-next-token", refreshToken: "next-token", sessionId: "shared-session" });
  });
  it("does not revive a session another tab forgot", async () => {
    let stored: AccountTokens | null = null;
    const vault = {
      save: async (v: AccountTokens) => {
        stored = v;
      },
      load: async () => stored,
      clear: async () => {
        stored = null;
      },
    } as TokenVault;
    const ended = vi.fn();
    const session = new AccountSession("", vault, ended);
    await session.adopt(grant("old-token"));
    stored = null;
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect(await session.reauthenticate()).toBe(false);
    expect(ended).toHaveBeenCalledWith("session_ended");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
