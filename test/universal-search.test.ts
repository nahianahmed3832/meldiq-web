import { describe, expect, it } from "vitest";
import { remember, sections, SECTIONS, serverTypes, usable } from "../src/sync/universalSearch";

/** The search screen's rules (android round 7 SearchRulesTest). */
describe("universal search rules", () => {
  it("device-only filters never ask the server", () => {
    expect(serverTypes("messages")).toBeNull();
    expect(serverTypes("files")).toBeNull();
    expect(serverTypes("pinned")).toBeNull();
    expect(serverTypes("people")).toBe("people");
    expect(serverTypes("all")).toBe("people,channels,workspaces,groups");
  });

  it("each filter shows its own section, all shows everything", () => {
    expect(sections("files")).toEqual(["files"]);
    expect(sections("all")).toEqual([...SECTIONS]);
  });

  it("recent searches are newest first, unique and bounded", () => {
    let r: string[] = [];
    for (const q of ["design", "a", "b", "c", "d", "DESIGN", "e"]) r = remember(r, q);
    expect(r).toEqual(["e", "DESIGN", "d", "c", "b", "a"]);
    expect(usable("   ")).toBeNull();
    expect(usable("x".repeat(80))?.length).toBe(60);
  });
});
