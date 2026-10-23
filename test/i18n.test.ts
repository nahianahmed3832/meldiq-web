import { describe, expect, it } from "vitest";
import { browserLanguage, resolveLanguage, translate } from "../src/i18n";
import { STRINGS } from "../src/i18n/strings";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("interface languages", () => {
  it("has every string in English, Chinese and Bengali, with the same placeholders", () => {
    for (const [key, texts] of Object.entries(STRINGS)) {
      expect(texts, key).toHaveLength(3);
      for (const t of texts) expect(t.trim(), key).not.toBe("");
      expect(placeholders(texts[1]), `${key} (zh-CN)`).toEqual(placeholders(texts[0]));
      expect(placeholders(texts[2]), `${key} (bn)`).toEqual(placeholders(texts[0]));
    }
  });

  it("follows the browser: any Chinese is Simplified, any Bengali is Bengali, anything else English", () => {
    expect(browserLanguage(["zh-TW", "en"])).toBe("zh-CN");
    expect(browserLanguage(["bn-IN"])).toBe("bn");
    expect(browserLanguage(["fr-FR", "bn"])).toBe("bn");
    expect(browserLanguage(["fr-FR"])).toBe("en");
    expect(browserLanguage([])).toBe("en");
    expect(resolveLanguage("system", ["zh-CN"])).toBe("zh-CN");
    expect(resolveLanguage("bn", ["zh-CN"])).toBe("bn");
  });

  it("fills placeholders and leaves unknown ones as they are", () => {
    expect(translate("en", "verify_sent", { email: "a@b.c" })).toBe("We sent a 6-digit code to a@b.c. It's valid for 15 minutes.");
    expect(translate("zh-CN", "common_password_min", { n: 10 })).toBe("至少 10 个字符。");
    expect(translate("bn", "nav_unread", {})).toBe("{n}টি অপঠিত");
  });
});
