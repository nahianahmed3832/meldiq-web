import "fake-indexeddb/auto";
import { describe, it, expect, vi } from "vitest";
import { showWakeNoticeOnce } from "../src/sw/swPrefs";
describe("persisted background notification identities", () => {
  it("shows a repeated event once even with simultaneous wake-ups, and scopes accounts", async () => {
    const shown = vi.fn(async () => undefined);
    await Promise.all(Array.from({ length: 5 }, () => showWakeNoticeOnce("device-a", "chat-a", "event-a", shown)));
    expect(shown).toHaveBeenCalledTimes(1);
    await showWakeNoticeOnce("device-a", "chat-a", "event-b", shown);
    await showWakeNoticeOnce("device-b", "chat-a", "event-a", shown);
    expect(shown).toHaveBeenCalledTimes(3);
  });
  it("retries a failed display rather than saving it as delivered", async () => {
    const fail = vi.fn(async () => {
      throw new Error("Display unavailable");
    });
    await expect(showWakeNoticeOnce("device-retry", "chat-b", "event-c", fail)).rejects.toThrow("Display unavailable");
    const show = vi.fn(async () => undefined);
    await showWakeNoticeOnce("device-retry", "chat-b", "event-c", show);
    await showWakeNoticeOnce("device-retry", "chat-b", "event-c", show);
    expect(show).toHaveBeenCalledTimes(1);
  });
});
