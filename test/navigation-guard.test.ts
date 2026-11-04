import { afterEach, describe, expect, it, vi } from "vitest";
import { cancelNavigation, discardAndNavigate, pendingNavigation, registerUnsavedEditor, requestNavigation } from "../src/application/navigationGuard";
afterEach(cancelNavigation);
describe("unsaved editor navigation", () => {
  it("preserves multiple independent drafts until explicit discard", () => {
    const first = registerUnsavedEditor();
    const second = registerUnsavedEditor();
    const leave = vi.fn();
    try {
      requestNavigation(leave);
      expect(leave).not.toHaveBeenCalled();
      cancelNavigation();
      expect(pendingNavigation()).toBe(false);
      first();
      requestNavigation(leave);
      expect(leave).not.toHaveBeenCalled();
      discardAndNavigate();
      expect(leave).toHaveBeenCalledOnce();
    } finally {
      first();
      second();
    }
  });
  it("allows navigation after editors save or unmount", () => {
    const clean = registerUnsavedEditor();
    clean();
    const leave = vi.fn();
    requestNavigation(leave);
    expect(leave).toHaveBeenCalledOnce();
  });
});
