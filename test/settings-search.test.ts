import { describe, expect, it } from "vitest";
import { matchesSetting } from "../src/ui/settings/settingsSearch";

describe("settings discovery", () => {
  it("finds existing pages by everyday tasks and scope", () => {
    expect(matchesSetting("calls", "Voice & audio", "microphone")).toBe(true);
    expect(matchesSetting("appearance", "Appearance", "font")).toBe(true);
    expect(matchesSetting("profile", "Profile", "banner")).toBe(true);
    expect(matchesSetting("notifications", "Notifications", "read receipts")).toBe(true);
    expect(matchesSetting("spark", "Spark", "community boost")).toBe(true);
    expect(matchesSetting("calls", "Voice & audio", "this browser")).toBe(true);
    expect(matchesSetting("profile", "Profile", "this browser")).toBe(false);
  });
  it("matches all words, ignores case and accents, and handles an empty search", () => {
    expect(matchesSetting("appearance", "Aparência", "APARENCIA")).toBe(true);
    expect(matchesSetting("calls", "Voice", "  noise   MICROPHONE ")).toBe(true);
    expect(matchesSetting("calls", "Voice", "noise gifts")).toBe(false);
    expect(matchesSetting("calls", "Voice", " ")).toBe(true);
  });
});
