import { afterEach, describe, expect, it, vi } from "vitest";
import { allowedSupabasePreview, zSupabasePreview } from "../src/auth/supabasePreviewConfig";
import { loadConfig, startConfig } from "../src/application/config";

const preview = {
  mode: "staging-check" as const,
  projectRef: "bkvlxbsnzqkhbifawcww" as const,
  url: "https://bkvlxbsnzqkhbifawcww.supabase.co" as const,
  publishableKey: "sb_publishable_synthetic_test_key",
};
const serve = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } }));
afterEach(() => vi.unstubAllGlobals());
describe("web migration deployment gate", () => {
  it("keeps the existing production configuration on its released auth path", async () => {
    expect((await loadConfig(serve({ environment: "production", apiBase: "" }))).supabaseMigration).toBe(false);
    expect(allowedSupabasePreview("production", preview, "web.meldiq.app")).toBeNull();
  });
  it("refuses enabling the preview through a production config", async () => {
    await expect(loadConfig(serve({ environment: "production", supabaseMigration: preview }))).rejects.toThrow("staging environment");
  });
  it("pins the separate staging project and only accepts publishable keys", () => {
    expect(zSupabasePreview.safeParse(preview).success).toBe(true);
    for (const value of [
      { ...preview, projectRef: "sgowwdmnavcsofzlgggm" },
      { ...preview, url: "https://other.supabase.co" },
      { ...preview, publishableKey: "sb_secret_must_never_be_public" },
      { ...preview, enabled: true },
    ])
      expect(zSupabasePreview.safeParse(value).success).toBe(false);
  });
  it("requires a dedicated staging host even when a config declares staging", () => {
    for (const host of ["web.meldiq.app", "evil.example", "localhost.evil.example"]) expect(allowedSupabasePreview("staging", preview, host)).toBeNull();
    for (const host of ["localhost", "127.0.0.1", "staging-web.meldiq.app"]) expect(allowedSupabasePreview("staging", preview, host)).toEqual(preview);
  });
  it("rechecks cached staging opt-in before showing it after a deployment rollback", async () => {
    const saved = JSON.stringify({ environment: "staging", supabaseMigration: preview });
    const storage = { getItem: () => saved, setItem: vi.fn(), removeItem: vi.fn() };
    vi.stubGlobal("localStorage", storage);
    const fresh = serve({ environment: "production" });
    const config = await startConfig(fresh);
    expect(fresh).toHaveBeenCalledOnce();
    expect(config.environment).toBe("production");
    expect(config.supabaseMigration).toBe(false);
    expect(storage.setItem).toHaveBeenCalledWith("meldiq.config.v1", expect.not.stringContaining("sb_publishable"));
  });
  it("does not activate cached staging credentials when fresh config is unavailable", async () => {
    vi.stubGlobal("localStorage", { getItem: () => JSON.stringify({ environment: "staging", supabaseMigration: preview }), setItem: vi.fn(), removeItem: vi.fn() });
    const config = await startConfig(
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    expect(config.supabaseMigration).toBe(false);
  });
});
