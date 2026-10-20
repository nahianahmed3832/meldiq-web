import { describe, expect, it } from "vitest";
import { atLeast, exportMarkdown, inlineSpans, parseMarkdown } from "../src/sync/documents";

/** Documents' rules (android round 7 DocRulesTest): roles, and the small Markdown subset (never HTML). */
describe("document rules", () => {
  it("roles rank view, comment, edit, admin", () => {
    expect(atLeast("edit", "comment")).toBe(true);
    expect(atLeast("comment", "edit")).toBe(false);
    expect(atLeast(null, "view")).toBe(false);
    expect(atLeast("admin", "admin")).toBe(true);
  });

  it("the Markdown subset parses line by line", () => {
    expect(parseMarkdown("# Title\n\n\n## Agenda\n- one\n- [x] done\n* [ ] todo\n1. first\n> quoted\nplain text\n\n")).toEqual([
      { kind: "heading", level: 1, text: "Title" },
      { kind: "gap" },
      { kind: "heading", level: 2, text: "Agenda" },
      { kind: "bullet", text: "one", checked: null },
      { kind: "bullet", text: "done", checked: true },
      { kind: "bullet", text: "todo", checked: false },
      { kind: "numbered", number: "1", text: "first" },
      { kind: "quote", text: "quoted" },
      { kind: "paragraph", text: "plain text" },
    ]);
  });

  it("bold and code are the only inline styles; HTML stays text", () => {
    expect(inlineSpans("Date: **today** run `npm test`")).toEqual([
      { text: "Date: ", bold: false, code: false },
      { text: "today", bold: true, code: false },
      { text: " run ", bold: false, code: false },
      { text: "npm test", bold: false, code: true },
    ]);
    expect(inlineSpans("no *markup* here")).toEqual([{ text: "no *markup* here", bold: false, code: false }]);
    expect(parseMarkdown("<script>alert(1)</script>")).toEqual([{ kind: "paragraph", text: "<script>alert(1)</script>" }]);
    expect(exportMarkdown({ title: "Plan", content: "- a" })).toBe("# Plan\n\n- a");
  });
});
