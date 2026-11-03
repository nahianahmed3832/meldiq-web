import { getPrefs, setPrefs } from "../src/application/prefs";
import { usageMetricLabel, usageLimitLabel } from "../src/sync/usage";
import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { browserLanguage, resolveLanguage, translate, prepareLocale, LANGUAGES } from "../src/i18n";
import { directionOf, preferredLanguage } from "../src/i18n/languages";
import { NAMESPACES } from "../src/i18n/namespaces";
import { ENGLISH } from "../src/i18n/english";
import { formatCurrency, formatDuration, formatFileSize, formatNumber } from "../src/i18n/format";
import type { Dictionary } from "../src/i18n/runtime";

const flatten = (dictionary: Dictionary, prefix = ""): Record<string, string> =>
  Object.fromEntries(Object.entries(dictionary).flatMap(([key, value]) => (typeof value === "string" ? [[prefix + key, value]] : Object.entries(flatten(value, prefix + key + ".")))));
beforeAll(async () => {
  await Promise.all(LANGUAGES.map((language) => prepareLocale(language, NAMESPACES)));
});

describe("interface languages", () => {
  it("configures all 28 distinct variants and all feature namespaces", () => {
    expect(LANGUAGES).toHaveLength(28);
    expect(new Set(LANGUAGES).size).toBe(28);
    for (const language of LANGUAGES)
      for (const namespace of NAMESPACES) {
        const data = JSON.parse(fs.readFileSync(path.resolve("locales", language, namespace + ".json"), "utf8"));
        const values = Object.values(flatten(data));
        expect(values.length, `${language}/${namespace}`).toBeGreaterThan(0);
        expect(values.every((value) => value.trim().length > 0)).toBe(true);
      }
  });
  it("contains every source key in all 28 catalogs", () => {
    for (const language of LANGUAGES)
      for (const namespace of NAMESPACES) {
        const translated = flatten(JSON.parse(fs.readFileSync(path.resolve("locales", language, namespace + ".json"), "utf8")));
        expect(Object.keys(translated).sort()).toEqual(Object.keys(flatten(ENGLISH[namespace])).sort());
      }
  });
  it("matches supported browser preferences without merging regional variants", () => {
    const examples = [
      ["zh-TW", "zh-TW"],
      ["zh-HK", "zh-TW"],
      ["zh-Hant-CN", "zh-TW"],
      ["zh-Hans", "zh-CN"],
      ["bn-IN", "bn"],
      ["fr-FR", "fr"],
      ["pt", "pt-PT"],
      ["pt-AO", "pt-PT"],
      ["pt-BR", "pt-BR"],
      ["es-MX", "es-419"],
      ["es-AR", "es-419"],
      ["es-ES", "es-ES"],
      ["ur-PK", "ur"],
      ["unsupported", "en"],
    ];
    for (const [browser, expected] of examples) expect(browserLanguage([browser])).toBe(expected);
    expect(browserLanguage(["xx-ZZ", "ja-JP", "en"])).toBe("ja");
    expect(browserLanguage([])).toBe("en");
    expect(resolveLanguage("system", ["zh-TW"])).toBe("zh-TW");
    expect(resolveLanguage("bn", ["zh-CN"])).toBe("bn");
  });
  it("prioritizes explicit account and guest choices over browser detection", () => {
    expect(preferredLanguage("de", "bn", ["ja"])).toBe("de");
    expect(preferredLanguage(undefined, "bn", ["ja"])).toBe("bn");
    expect(preferredLanguage(null, null, ["ja"])).toBe("ja");
    expect(preferredLanguage("bad", "bad", ["unsupported"])).toBe("en");
  });
  it("fills placeholders without interpreting user data as markup or code", () => {
    expect(translate("en", "verify_sent", { email: "a@b.c" })).toBe("We sent a 6-digit code to a@b.c. It's valid for 15 minutes.");
    expect(translate("zh-CN", "common_password_min", { n: 10 })).toBe("至少 10 个字符。");
    expect(translate("bn", "nav_unread", {})).toBe("{n}টি অপঠিত");
    expect(translate("en", "home_greeting", { greeting: "Hello", name: "<script>Meldiq</script>" })).toBe("Hello, <script>Meldiq</script>");
  });
  it("uses native plural grammar and local digits", () => {
    expect(translate("en", "common.counts.members", { count: 1 })).toBe("1 member");
    expect(translate("en", "common.counts.members", { count: 2 })).toBe("2 members");
    expect(translate("ar", "common.counts.members", { count: 2 })).toBe("عضوان");
    expect(translate("ru", "common.counts.members", { count: 21 })).toBe("21 участник");
    expect(translate("ru", "common.counts.members", { count: 22 })).toBe("22 участника");
    for (const language of LANGUAGES)
      for (const count of [0, 1, 2, 3, 11, 21, 102]) {
        const text = translate(language, "files.counts.files", { count });
        expect(text).not.toMatch(/[{}]/);
        expect(text.trim()).not.toBe("");
      }
  });
  it("falls back to English and reports missing keys without logging private variables", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(translate("de", "verify_sent", { email: "private@example.test" })).toContain("private@example.test");
    expect(JSON.stringify(warning.mock.calls)).not.toContain("private@example.test");
    warning.mockRestore();
  });
  it("localizes only the audited server usage labels and preserves custom metadata", () => {
    const previous = getPrefs().language;
    vi.stubGlobal("document", { documentElement: { setAttribute: vi.fn(), removeAttribute: vi.fn(), style: { setProperty: vi.fn(), removeProperty: vi.fn() } }, querySelector: () => null });
    vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "" }));
    try {
      setPrefs({ language: "de" });
      expect(usageMetricLabel("seats.members", "Members")).not.toBe("Members");
      expect(usageMetricLabel("seats.members", "Founders and friends")).toBe("Founders and friends");
      expect(usageMetricLabel("future.metric", "Members")).toBe("Members");
      expect(usageLimitLabel("roles.custom", "Custom roles")).not.toBe("Custom roles");
      expect(usageLimitLabel("roles.custom", "My roles")).toBe("My roles");
      setPrefs({ language: "en" });
      expect(usageMetricLabel("seats.members", "Members")).toBe("Members");
    } finally {
      setPrefs({ language: previous });
      vi.unstubAllGlobals();
    }
  });
  it("sets actual document direction only for Arabic and Urdu", () => {
    for (const language of LANGUAGES) expect(directionOf(language)).toBe(["ar", "ur"].includes(language) ? "rtl" : "ltr");
  });
  it("formats numbers, bytes, elapsed time and currency without changing the amount", () => {
    expect(formatNumber(1234.5, {}, "de")).toBe("1.234,5");
    expect(formatFileSize(1536, 1024, "de")).toBe("1,5 KB");
    expect(formatDuration(3_661_000, "en")).toBe("1:01:01");
    expect(formatDuration(-100, "en")).toBe("0:00");
    expect(formatCurrency(3.99, "USD", "de")).toBe(new Intl.NumberFormat("de", { style: "currency", currency: "USD" }).format(3.99));
  });
});
