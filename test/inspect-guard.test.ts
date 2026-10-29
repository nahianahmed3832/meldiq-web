import { describe, expect, it } from "vitest";
import { opensInspector } from "../src/application/inspectGuard";

const key = (code: string, mods: Partial<Record<"ctrlKey" | "metaKey" | "altKey" | "shiftKey", boolean>> = {}) => ({
  key: code.startsWith("Key") ? code.slice(3).toLowerCase() : code,
  code,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

describe("opensInspector", () => {
  it("catches F12 and the developer tools shortcuts on Windows and Mac", () => {
    expect(opensInspector(key("F12"))).toBe(true);
    expect(opensInspector(key("KeyI", { ctrlKey: true, shiftKey: true }))).toBe(true);
    expect(opensInspector(key("KeyJ", { ctrlKey: true, shiftKey: true }))).toBe(true);
    expect(opensInspector(key("KeyC", { ctrlKey: true, shiftKey: true }))).toBe(true);
    expect(opensInspector(key("KeyI", { metaKey: true, altKey: true }))).toBe(true);
    expect(opensInspector(key("KeyJ", { metaKey: true, altKey: true }))).toBe(true);
  });

  it("catches View Source", () => {
    expect(opensInspector(key("KeyU", { ctrlKey: true }))).toBe(true);
    expect(opensInspector(key("KeyU", { metaKey: true, altKey: true }))).toBe(true);
  });

  it("leaves everyday shortcuts alone", () => {
    expect(opensInspector(key("KeyC", { metaKey: true }))).toBe(false);
    expect(opensInspector(key("KeyC", { ctrlKey: true }))).toBe(false);
    expect(opensInspector(key("KeyI", { metaKey: true }))).toBe(false);
    expect(opensInspector(key("KeyM", { metaKey: true, shiftKey: true }))).toBe(false);
    expect(opensInspector(key("KeyU", { metaKey: true }))).toBe(false);
    expect(opensInspector(key("KeyI"))).toBe(false);
  });
});
