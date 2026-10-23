import { afterEach, describe, expect, it } from "vitest";
import { TranslateError, translateText, translationSupported } from "../src/sync/translate";

/**
 * Translation on the device (android MessageTranslator), with the browser's built-in Translator and LanguageDetector.
 * Node has neither, so they're stood in for here; real model output is checked by hand in Chrome.
 */
const g = globalThis as Record<string, unknown>;
let created: string[] = [];

function install(detected: { detectedLanguage: string; confidence: number }[], pairs: Record<string, "available" | "unavailable" | "downloadable">) {
  created = [];
  g.LanguageDetector = { availability: async () => "available", create: async () => ({ detect: async () => detected, destroy: () => undefined }) };
  g.Translator = {
    availability: async (o: { sourceLanguage: string; targetLanguage: string }) => pairs[`${o.sourceLanguage}>${o.targetLanguage}`] ?? "unavailable",
    create: async (o: { sourceLanguage: string; targetLanguage: string; monitor?: (m: { addEventListener(t: string, f: (e: { loaded: number }) => void): void }) => void }) => {
      created.push(`${o.sourceLanguage}>${o.targetLanguage}`);
      o.monitor?.({ addEventListener: (_t, f) => f({ loaded: 1 }) });
      return { translate: async (text: string) => `[${o.targetLanguage}] ${text}`, destroy: () => undefined };
    },
  };
}

afterEach(() => {
  delete g.LanguageDetector;
  delete g.Translator;
});

describe("translation on the device", () => {
  it("isn't offered where the browser has no on-device translator", async () => {
    expect(translationSupported()).toBe(false);
    await expect(translateText("hola", "en")).rejects.toBeInstanceOf(TranslateError);
  });

  it("detects the language, translates on the device and reports the model download", async () => {
    install([{ detectedLanguage: "es", confidence: 0.92 }], { "es>en": "downloadable" });
    const progress: number[] = [];
    expect(await translateText("hola", "en", (p) => progress.push(p))).toBe("[en] hola");
    expect(created).toEqual(["es>en"]);
    expect(progress).toEqual([1]);
  });

  it("refuses unclear languages, the same language and unavailable pairs, without translating", async () => {
    install([{ detectedLanguage: "zh-Hans", confidence: 0.9 }], {});
    await expect(translateText("你好", "zh")).rejects.toThrow(/already in that language/);
    install([{ detectedLanguage: "fr", confidence: 0.1 }], { "fr>en": "available" });
    await expect(translateText("?", "en")).rejects.toThrow(/Couldn't tell/);
    install([{ detectedLanguage: "xx", confidence: 0.9 }], {});
    await expect(translateText("xx", "en")).rejects.toThrow(/isn't available/);
    expect(created).toEqual([]);
  });
});

describe("when the browser's translator misbehaves", () => {
  it("a hanging model or a browser error ends with one plain message, not a raw error or an endless wait", async () => {
    install([{ detectedLanguage: "es", confidence: 0.9 }], { "es>en": "downloadable" });
    (g.Translator as { create: unknown }).create = async () => {
      throw new DOMException("Model not available", "NotSupportedError");
    };
    await expect(translateText("hola", "en")).rejects.toThrow(/couldn't be loaded/);
    (g.Translator as { create: unknown }).create = () => new Promise(() => undefined);
    await expect(translateText("hola", "en", undefined, { ask: 50, model: 50 })).rejects.toThrow(/couldn't be loaded/);
  });
});

describe("the language to translate into", () => {
  it("is the person's last choice, else the interface's", async () => {
    const { defaultTarget } = await import("../src/sync/translate");
    expect(defaultTarget(true, "bn", "zh-CN")).toBe("bn");
    expect(defaultTarget(false, "en", "zh-CN")).toBe("zh");
    expect(defaultTarget(false, "en", "bn")).toBe("bn");
    expect(defaultTarget(false, "zh", "en")).toBe("en");
  });
});
