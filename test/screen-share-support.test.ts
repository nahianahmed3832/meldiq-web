import { afterEach, describe, expect, it, vi } from "vitest";
import { screenShareSupport } from "../src/call/screenShareSupport";

afterEach(() => vi.unstubAllGlobals());
const browser = (userAgent: string, capture: boolean, secure = true) => {
  vi.stubGlobal("window", { isSecureContext: secure });
  vi.stubGlobal("navigator", { userAgent, mediaDevices: capture ? { getDisplayMedia: vi.fn() } : {} });
};
describe("screen capture capability", () => {
  it("allows capable iPhone, iPad, Android and desktop browsers without a user-agent blacklist", () => {
    for (const ua of ["iPhone OS 27 Safari", "iPad Safari", "Android Chrome", "Macintosh Safari", "Windows Chrome"]) {
      browser(ua, true);
      expect(screenShareSupport()).toEqual({ ok: true, reason: null });
    }
  });
  it("explains missing capture APIs while keeping watching separate from publishing", () => {
    for (const ua of ["iPhone OS 18 Safari", "Android Chrome", "Android Firefox"]) {
      browser(ua, false);
      const support = screenShareSupport();
      expect(support.ok).toBe(false);
      expect(support.reason).toContain("still watch");
      expect(support.reason).toContain("supported desktop browser");
    }
  });
  it("requires HTTPS and tolerates environments without browser globals", () => {
    browser("Desktop", true, false);
    expect(screenShareSupport().reason).toContain("HTTPS");
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("navigator", undefined);
    expect(screenShareSupport().ok).toBe(false);
  });
});
