import { describe, expect, it } from "vitest";
import { iosNeedsHomeScreen, needsRegistration, pushState, type PushStateInput, REGISTER_AGAIN_MS } from "../src/app/pushRules";

const base: PushStateInput = { supported: true, secure: true, serverOffers: true, configured: true, permission: "granted", enabled: true, registered: true, busy: false, error: null };

describe("background notifications: the state Settings shows (web push)", () => {
  it("is on only with everything in place", () => {
    expect(pushState(base)).toBe("on");
  });

  it("names what's missing, browser first, then the site, then the person's choices", () => {
    expect(pushState({ ...base, supported: false })).toBe("unsupported");
    expect(pushState({ ...base, secure: false })).toBe("insecure");
    expect(pushState({ ...base, serverOffers: false })).toBe("not-offered");
    expect(pushState({ ...base, configured: false })).toBe("not-configured");
    expect(pushState({ ...base, permission: "denied" })).toBe("denied");
    expect(pushState({ ...base, permission: "default" })).toBe("needs-permission");
    expect(pushState({ ...base, enabled: false })).toBe("off");
    expect(pushState({ ...base, registered: false, busy: true })).toBe("registering");
    expect(pushState({ ...base, registered: false, error: "push service error" })).toBe("failed");
    expect(pushState({ ...base, registered: false })).toBe("needs-registration");
  });
});

describe("when this browser registers its token again", () => {
  const now = 10 * REGISTER_AGAIN_MS;
  it("on a new token, a new device (signed in again), or once a day", () => {
    const saved = { deviceId: "d1", token: "t1", at: now - 1000 };
    expect(needsRegistration(saved, "d1", "t1", now)).toBe(false);
    expect(needsRegistration(saved, "d1", "t2", now)).toBe(true);
    expect(needsRegistration(saved, "d2", "t1", now)).toBe(true);
    expect(needsRegistration({ ...saved, at: now - REGISTER_AGAIN_MS - 1 }, "d1", "t1", now)).toBe(true);
    expect(needsRegistration(null, "d1", "t1", now)).toBe(true);
  });
});

describe("Desktop notifications before the person chose (the 'allowed but nothing shows' bug)", () => {
  it("follow the site's permission until chosen; a choice wins either way", async () => {
    const { notificationChoice } = await import("../src/app/prefs");
    expect(notificationChoice({ notifications: false }, true)).toEqual({ notifyChoice: "unset", notifications: true });
    expect(notificationChoice({ notifications: false }, false)).toEqual({ notifyChoice: "unset", notifications: false });
    expect(notificationChoice({ notifications: true }, false)).toEqual({ notifyChoice: "on", notifications: true });
    expect(notificationChoice({ notifications: true, notifyChoice: "off" }, true)).toEqual({ notifyChoice: "off", notifications: false });
  });
});

describe("iPhone and iPad: push only from the Home Screen", () => {
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1";
  const ipad = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
  it("asks for the Home Screen in Safari on an iPhone or iPad, not once opened from there, and never on a Mac", () => {
    expect(iosNeedsHomeScreen(iphone, false, 5)).toBe(true);
    expect(iosNeedsHomeScreen(iphone, true, 5)).toBe(false);
    expect(iosNeedsHomeScreen(ipad, false, 5)).toBe(true);
    expect(iosNeedsHomeScreen(ipad, false, 0)).toBe(false);
  });
});
