import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Brief v4 §13: the pre-email way into an account (phone-only linking) is left out of release builds; only development
 * and the browser-test build keep it, for the test phones.
 */
describe("phone-only linking", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  const load = async () => (await import("../src/auth/testLinking")).TEST_DEVICE_LINKING;

  it("is off in a release build", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_MELDIQ_TEST_LINKING", "");
    expect(await load()).toBe(false);
  });

  it("is on in development and in the browser-test build", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(await load()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_MELDIQ_TEST_LINKING", "1");
    expect(await load()).toBe(true);
  });
});
