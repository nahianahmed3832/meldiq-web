import { describe, expect, it, vi } from "vitest";
import { AuthMigrationError, prepareLegacySupabaseLink, prepareSupabaseDevice } from "../src/auth/supabaseMigration";

const authUserId = "10000000-0000-4000-8000-000000000001",
  sessionId = "20000000-0000-4000-8000-000000000001";
const token = `eyJhbGciOiJFUzI1NiJ9.${btoa(JSON.stringify({ sub: authUserId, session_id: sessionId, user_metadata: { userId: "forged" } })).replace(/=/g, "")}.signature`;
const owner = Object.freeze({ accountId: "account_original", userId: "user_original", deviceId: "device_original" });
const signature = btoa("s".repeat(64)),
  nonce = "synthetic_one_use_nonce_12345678";
function fixture() {
  const responses: unknown[] = [{ nonce, expiresAt: Date.now() + 120000 }, { ok: true }, { authUserId, accountId: owner.accountId, userId: owner.userId }];
  const request = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify(responses.shift()), { status: 200, headers: { "content-type": "application/json" } }));
  const signDeviceProof = vi.fn(async (_message: string) => signature);
  const options = {
    apiOrigin: "https://api.example.test",
    providerSession: { access_token: token, user: { id: authUserId } },
    expectedOwner: owner,
    signDeviceProof,
    legacyAccessToken: "synthetic_legacy_access_token_123456",
    password: "synthetic old password",
    totpCode: "123456",
    fetch: request,
  };
  return { options, request, signDeviceProof, responses };
}
describe("staged web account migration transport", () => {
  it("signs the exact provider/session/device/nonce context and confirms original ownership before returning a receipt", async () => {
    const f = fixture();
    expect(await prepareLegacySupabaseLink(f.options)).toEqual({ ...owner, authUserId, providerSessionId: sessionId });
    expect(f.signDeviceProof).toHaveBeenCalledWith(`meldiq-supabase-device-v1\n${authUserId}\n${sessionId}\n${owner.deviceId}\n${nonce}`);
    const [url, init] = f.request.mock.calls[1];
    expect(url).toBe("https://api.example.test/v3/auth/legacy-link");
    expect(JSON.parse(String(init?.body))).toEqual({ deviceId: owner.deviceId, nonce, signature, legacyAccessToken: f.options.legacyAccessToken, password: f.options.password, totpCode: "123456" });
    expect(f.options.expectedOwner).toBe(owner);
  });
  it("prevents credential redirects, shared caching and incidental cookie transmission", async () => {
    const f = fixture();
    await prepareLegacySupabaseLink(f.options);
    for (const [url, init] of f.request.mock.calls) {
      expect(String(url)).not.toContain(f.options.legacyAccessToken);
      expect(String(url)).not.toContain(f.options.password);
      expect(init).toMatchObject({ redirect: "error", cache: "no-store", credentials: "omit", headers: { authorization: `Bearer ${token}` } });
    }
  });
  it("rejects mismatched ownership without changing the existing identity or SDK session", async () => {
    const f = fixture();
    f.responses[2] = { authUserId, accountId: owner.accountId, userId: "someone_else" };
    const before = structuredClone(f.options.providerSession);
    await expect(prepareLegacySupabaseLink(f.options)).rejects.toMatchObject({ code: "identity_mismatch" });
    expect(f.options.expectedOwner).toEqual(owner);
    expect(f.options.providerSession).toEqual(before);
  });
  it("does not infer ownership from JWT metadata or an unrelated provider session", async () => {
    const f = fixture();
    f.options.providerSession.user.id = "10000000-0000-4000-8000-000000000002";
    await expect(prepareLegacySupabaseLink(f.options)).rejects.toMatchObject({ code: "invalid_provider_session" });
    expect(f.request).not.toHaveBeenCalled();
    expect(f.signDeviceProof).not.toHaveBeenCalled();
  });
  it("refuses insecure nonlocal or credential-bearing API origins before sending secrets", async () => {
    for (const apiOrigin of ["http://api.example.test", "https://user:password@api.example.test", "https://api.example.test/?redirect=evil", "https://api.example.test/path"]) {
      const f = fixture();
      await expect(prepareLegacySupabaseLink({ ...f.options, apiOrigin })).rejects.toMatchObject({ code: "invalid_api_origin" });
      expect(f.request).not.toHaveBeenCalled();
    }
  });
  it("supports a later certified-device binding without resending legacy credentials", async () => {
    const f = fixture();
    await prepareSupabaseDevice(f.options);
    expect(f.request.mock.calls[1][0]).toBe("https://api.example.test/v3/auth/device");
    expect(JSON.parse(String(f.request.mock.calls[1][1]?.body))).not.toHaveProperty("legacyAccessToken");
    expect(JSON.parse(String(f.request.mock.calls[1][1]?.body))).not.toHaveProperty("password");
  });
  it("keeps failure messages free of server text, tokens and passwords", async () => {
    const f = fixture();
    f.request.mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "unauthorized", message: `${token} ${f.options.password}` } }), { status: 401 }));
    try {
      await prepareLegacySupabaseLink(f.options);
      throw new Error("expected refusal");
    } catch (error) {
      expect(error).toBeInstanceOf(AuthMigrationError);
      expect(error).toMatchObject({ code: "unauthorized", status: 401 });
      expect(String(error)).not.toContain(f.options.password);
      expect(String(error)).not.toContain(token);
    }
    expect(f.signDeviceProof).not.toHaveBeenCalled();
  });
  it("refuses expired challenges before signing or linking", async () => {
    const f = fixture();
    f.responses[0] = { nonce, expiresAt: Date.now() - 1 };
    await expect(prepareLegacySupabaseLink(f.options)).rejects.toMatchObject({ code: "invalid_device_challenge" });
    expect(f.signDeviceProof).not.toHaveBeenCalled();
    expect(f.request).toHaveBeenCalledTimes(1);
  });
  it("keeps one provider token throughout an in-flight proof when the caller's SDK state changes", async () => {
    const f = fixture();
    f.request.mockImplementationOnce(async () => {
      f.options.providerSession.access_token = "a_different_sdk_session";
      f.responses.shift();
      return new Response(JSON.stringify({ nonce, expiresAt: Date.now() + 120000 }), { status: 200 });
    });
    await prepareLegacySupabaseLink(f.options);
    for (const [, init] of f.request.mock.calls) expect(init?.headers).toMatchObject({ authorization: `Bearer ${token}` });
  });
  it("returns only owner identifiers and rejects a malformed server challenge", async () => {
    const f = fixture();
    const result = await prepareLegacySupabaseLink({ ...f.options, expectedOwner: { ...owner, privateKey: "must-not-copy" } } as typeof f.options);
    expect(result).not.toHaveProperty("privateKey");
    const broken = fixture();
    broken.responses[0] = null;
    await expect(prepareLegacySupabaseLink(broken.options)).rejects.toMatchObject({ code: "invalid_device_challenge" });
  });
});
