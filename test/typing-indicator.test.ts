import { describe, expect, it } from "vitest";
import { translate } from "../src/i18n";
import { typingNames } from "../src/ui/chat/TypingIndicator";

const en = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) => translate("en", key, vars);

describe("the Meldling typing indicator's names", () => {
  it("says nothing when nobody types", () => {
    expect(typingNames(en, [])).toBe("");
  });

  it("names one, two, or two and how many others", () => {
    expect(typingNames(en, ["Ana"])).toBe("Ana is typing");
    expect(typingNames(en, ["Ana", "Bo"])).toBe("Ana and Bo are typing");
    expect(typingNames(en, ["Ana", "Bo", "Cy", "Di"])).toBe("Ana, Bo and 2 others are typing");
  });

  it("keeps the mascot's name in every language", () => {
    for (const lang of ["en", "zh-CN", "bn"] as const) expect(translate(lang, "typing_meldling")).toBe("Meldling");
  });
});
