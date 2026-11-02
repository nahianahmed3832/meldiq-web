import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkSupabaseSignIn } from "../src/auth/supabasePreview";
import { EncryptedSupabaseStorage } from "../src/auth/supabaseClient";
import { LocalStore } from "../src/store/db";

const authUserId = "10000000-0000-4000-8000-000000000001",
  sessionId = "20000000-0000-4000-8000-000000000001";
const token = `eyJhbGciOiJFUzI1NiJ9.${btoa(JSON.stringify({ sub: authUserId, session_id: sessionId, exp: Math.floor(Date.now() / 1000) + 3600 })).replace(/=/g, "")}.signature`;
const provider = {
  mode: "staging-check" as const,
  projectRef: "bkvlxbsnzqkhbifawcww" as const,
  url: "https://bkvlxbsnzqkhbifawcww.supabase.co" as const,
  publishableKey: "sb_publishable_synthetic_test_key",
};
const owner = { accountId: "original_account", userId: "original_user", deviceId: "original_device" };
let store: LocalStore;
afterEach(() => {
  store?.close();
  vi.unstubAllGlobals();
});
async function fixture() {
  store = await LocalStore.open(`preview-${crypto.randomUUID()}`);
  await store.legacy.put("kv", { keys: "protected-original-device" }, "device");
  await store.legacy.put("kv", "original-legacy-session", "legacy-token");
  await store.legacy.put("outbox", {
    messageId: "pending-message",
    conversationId: "original-conversation",
    cls: "message",
    payloadJson: "original-pending-send",
    createdAt: 1000,
    attempts: 0,
    nextAttemptAt: 0,
    lastError: null,
    visible: true,
    held: false,
  });
  const session = { access_token: token, user: { id: authUserId } };
  let key = "";
  const auth = {
    signInWithPassword: vi.fn(async () => {
      await new EncryptedSupabaseStorage(store).setItem(key, JSON.stringify(session));
      return { data: { session }, error: null };
    }),
    getSession: vi.fn(async () => ({ data: { session }, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    dispose: vi.fn(async () => {}),
  };
  const responses: unknown[] = [
    { nonce: "synthetic_one_use_nonce_12345678", expiresAt: Date.now() + 120000 },
    { ok: true },
    { authUserId, accountId: owner.accountId, userId: owner.userId },
    { ok: true },
  ];
  const request = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify(responses.shift()), { status: 200 }));
  const client = vi.fn((value: string) => {
    key = value;
    return { auth, realtime: { disconnect: vi.fn() } } as unknown as SupabaseClient;
  });
  const options = {
    provider,
    store,
    apiOrigin: "https://api.example.test",
    owner,
    legacyAccessToken: "synthetic_legacy_access_token_123456",
    email: "synthetic@example.invalid",
    password: "synthetic provider password",
    legacyPassword: "synthetic legacy password",
    isCurrentOwner: vi.fn(() => true),
    signDeviceProof: vi.fn(async () => btoa("s".repeat(64))),
  };
  return { options, auth, responses, request, client, getKey: () => key };
}
describe("staging web sign-in rehearsal", () => {
  it("runs the actual SDK with sealed storage, bounded credential requests and local-scope logout", async () => {
    const f = await fixture();
    const sdkFetch = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = new URL(String(input));
      expect(url.origin).toBe(provider.url);
      if (url.pathname.endsWith("/token"))
        return new Response(
          JSON.stringify({
            access_token: token,
            refresh_token: "synthetic_sdk_refresh_token",
            token_type: "bearer",
            expires_in: 3600,
            user: { id: authUserId, aud: "authenticated", app_metadata: { provider: "email" }, user_metadata: {}, created_at: new Date().toISOString() },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      expect(url.pathname.endsWith("/logout")).toBe(true);
      expect(url.searchParams.get("scope")).toBe("local");
      return new Response(null, { status: 204 });
    });
    vi.stubGlobal("fetch", sdkFetch);
    expect(await checkSupabaseSignIn(f.options, { fetch: f.request })).toMatchObject({ ...owner, authUserId });
    expect(sdkFetch).toHaveBeenCalledTimes(2);
    for (const [, init] of sdkFetch.mock.calls) expect(init).toMatchObject({ credentials: "omit", redirect: "error", cache: "no-store" });
    const keys = await store.legacy.getAllKeys("kv");
    expect(keys.some((key) => String(key).includes("meldiq-supabase-preview:"))).toBe(false);
    expect(await store.legacy.get("kv", "legacy-token")).toBe("original-legacy-session");
  });
  it("verifies exact ownership then revokes both test sessions without changing keys, legacy auth or the offline outbox", async () => {
    const f = await fixture();
    expect(await checkSupabaseSignIn(f.options, { client: f.client, fetch: f.request })).toEqual({ ...owner, authUserId, providerSessionId: sessionId });
    expect(f.request.mock.calls[3]).toMatchObject([
      "https://api.example.test/v3/auth/session",
      { method: "DELETE", redirect: "error", credentials: "omit", cache: "no-store", headers: { authorization: `Bearer ${token}` } },
    ]);
    expect(f.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(f.auth.dispose).toHaveBeenCalledOnce();
    expect(await new EncryptedSupabaseStorage(store).getItem(f.getKey())).toBeNull();
    expect(await store.legacy.get("kv", "device")).toEqual({ keys: "protected-original-device" });
    expect(await store.legacy.get("kv", "legacy-token")).toBe("original-legacy-session");
    expect(await store.legacy.get("outbox", "pending-message")).toMatchObject({ messageId: "pending-message", payloadJson: "original-pending-send", attempts: 0 });
  });
  it("rejects a real-user address before opening an SDK session", async () => {
    const f = await fixture();
    await expect(checkSupabaseSignIn({ ...f.options, email: "person@real.example" }, { client: f.client, fetch: f.request })).rejects.toMatchObject({ code: "synthetic_account_required" });
    expect(f.client).not.toHaveBeenCalled();
    expect(f.request).not.toHaveBeenCalled();
  });
  it("does not create a new session for an account that has already switched", async () => {
    const f = await fixture();
    f.options.isCurrentOwner.mockReturnValue(false);
    await expect(checkSupabaseSignIn(f.options, { client: f.client, fetch: f.request })).rejects.toMatchObject({ code: "preview_cancelled" });
    expect(f.client).not.toHaveBeenCalled();
  });
  it("fences cancellation during provider sign-in and still ends and removes the SDK session", async () => {
    const f = await fixture(),
      abort = new AbortController();
    f.auth.signInWithPassword.mockImplementationOnce(async () => {
      abort.abort();
      return { data: { session: { access_token: token, user: { id: authUserId } } }, error: null };
    });
    await expect(checkSupabaseSignIn({ ...f.options, signal: abort.signal }, { client: f.client, fetch: f.request })).rejects.toMatchObject({ code: "preview_cancelled" });
    expect(f.request).not.toHaveBeenCalled();
    expect(f.auth.signOut).toHaveBeenCalledOnce();
    expect(f.auth.dispose).toHaveBeenCalledOnce();
  });
  it("rejects mismatched ownership and cleans up without revoking an unverified application binding", async () => {
    const f = await fixture();
    f.responses[2] = { authUserId, accountId: "other-account", userId: owner.userId };
    await expect(checkSupabaseSignIn(f.options, { client: f.client, fetch: f.request })).rejects.toMatchObject({ code: "identity_mismatch" });
    expect(f.request).toHaveBeenCalledTimes(3);
    expect(f.auth.signOut).toHaveBeenCalledOnce();
  });
  it("refuses a stale result if SDK state changes after the device proof", async () => {
    const f = await fixture();
    f.auth.getSession.mockResolvedValueOnce({ data: { session: { access_token: "changed-token", user: { id: authUserId } } }, error: null });
    await expect(checkSupabaseSignIn(f.options, { client: f.client, fetch: f.request })).rejects.toMatchObject({ code: "provider_session_changed" });
    expect(f.request.mock.calls.at(-1)?.[1]?.method).toBe("DELETE");
  });
  it("does not call a test passed when session cleanup fails", async () => {
    const f = await fixture();
    f.request.mockImplementationOnce(async () => new Response(JSON.stringify(f.responses.shift()), { status: 200 }));
    f.auth.signOut.mockRejectedValueOnce(new Error(`private ${token} ${f.options.password}`));
    await expect(checkSupabaseSignIn(f.options, { client: f.client, fetch: f.request })).rejects.toMatchObject({ code: "preview_cleanup_failed" });
    expect(await new EncryptedSupabaseStorage(store).getItem(f.getKey())).toBeNull();
  });
});
