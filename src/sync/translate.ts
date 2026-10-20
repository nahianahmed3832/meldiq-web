/**
 * Translating a received message on this device (android MessageTranslator, docs/LANGUAGES.md › Translation), with the
 * browser's own on-device Translator and LanguageDetector (Chromium's built-in AI APIs). The message text is never
 * sent anywhere; the browser may download its language model the first time. Where the browser has no on-device
 * translator, the option isn't offered: the text is never sent to a translation service.
 */
export const TRANSLATE_TARGETS = [
  { code: "en", label: "English" },
  { code: "zh", label: "Chinese (Simplified)" },
  { code: "bn", label: "Bengali" },
] as const;
export type TranslateTarget = (typeof TRANSLATE_TARGETS)[number]["code"];

export class TranslateError extends Error {}

type Availability = "unavailable" | "downloadable" | "downloading" | "available";
interface Monitor {
  addEventListener(type: "downloadprogress", fn: (e: { loaded: number }) => void): void;
}
interface TranslatorApi {
  availability(o: { sourceLanguage: string; targetLanguage: string }): Promise<Availability>;
  create(o: { sourceLanguage: string; targetLanguage: string; monitor?: (m: Monitor) => void }): Promise<{ translate(text: string): Promise<string>; destroy(): void }>;
}
interface DetectorApi {
  availability(): Promise<Availability>;
  create(): Promise<{ detect(text: string): Promise<{ detectedLanguage: string; confidence: number }[]>; destroy(): void }>;
}

const apis = (): { translator: TranslatorApi; detector: DetectorApi } | null => {
  const g = globalThis as unknown as { Translator?: TranslatorApi; LanguageDetector?: DetectorApi };
  return g.Translator && g.LanguageDetector ? { translator: g.Translator, detector: g.LanguageDetector } : null;
};

/** Whether this browser can translate on the device. */
export const translationSupported = (): boolean => apis() !== null;

/** The language part of a tag ("zh-Hans" → "zh"). */
const base = (tag: string): string => tag.toLowerCase().split(/[-_]/)[0];

const MIN_CONFIDENCE = 0.4;
/** Asking what the browser can do, and getting its model (android: 120 s for the download). */
const ASK_MS = 15_000;
const MODEL_MS = 120_000;
const UNAVAILABLE = "Translation isn't available in this browser right now: its language model couldn't be loaded.";

/** [p], or a TranslateError after [ms]; the browser's own errors become one plain message. */
async function within<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([p, new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new TranslateError(UNAVAILABLE)), ms)))]);
  } catch (e) {
    throw e instanceof TranslateError ? e : new TranslateError(UNAVAILABLE);
  } finally {
    clearTimeout(timer);
  }
}

/** Translates [text] into [target] on this device; [onProgress] gets the model download share (0–1) when there is one. */
export async function translateText(text: string, target: TranslateTarget, onProgress?: (share: number) => void, timeouts = { ask: ASK_MS, model: MODEL_MS }): Promise<string> {
  const api = apis();
  if (!api) throw new TranslateError("This browser can't translate on the device.");
  if ((await within(api.detector.availability(), timeouts.ask)) === "unavailable") throw new TranslateError("This browser can't identify the message's language.");
  const detector = await within(api.detector.create(), timeouts.model);
  let source: string;
  try {
    const best = (await within(detector.detect(text), timeouts.ask))[0];
    if (!best || best.confidence < MIN_CONFIDENCE || best.detectedLanguage === "und") throw new TranslateError("Couldn't tell which language this message is in.");
    source = base(best.detectedLanguage);
  } finally {
    detector.destroy();
  }
  if (source === base(target)) throw new TranslateError("This message is already in that language.");
  const pair = { sourceLanguage: source, targetLanguage: target };
  if ((await within(api.translator.availability(pair), timeouts.ask)) === "unavailable") throw new TranslateError("Translating from this language isn't available in this browser.");
  const translator = await within(api.translator.create({ ...pair, monitor: (m) => m.addEventListener("downloadprogress", (e) => onProgress?.(e.loaded)) }), timeouts.model);
  try {
    const out = (await within(translator.translate(text), timeouts.model)).trim();
    if (!out) throw new TranslateError("The translation came back empty.");
    return out;
  } finally {
    translator.destroy();
  }
}
