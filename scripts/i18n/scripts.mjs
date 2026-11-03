const writingSystems = {
  bn: ["Bengali"],
  hi: ["Devanagari"],
  ur: ["Arabic"],
  ar: ["Arabic"],
  "zh-CN": ["Han"],
  "zh-TW": ["Han"],
  ja: ["Han", "Hiragana", "Katakana"],
  ko: ["Hangul", "Han"],
  th: ["Thai"],
  ru: ["Cyrillic"],
  uk: ["Cyrillic"],
  el: ["Greek"],
};
const patterns = new Map();
/** Common/inherited characters include Arabic tatweel, kana marks, symbols and shared notation. */
export function unexpectedWritingSystem(message, source, locale) {
  let allowed = patterns.get(locale);
  if (!allowed) {
    allowed = new RegExp(["Latin", "Common", "Inherited", ...(writingSystems[locale] ?? [])].map((name) => `\\p{Script=${name}}`).join("|"), "u");
    patterns.set(locale, allowed);
  }
  return [...message].some((character) => /\p{L}/u.test(character) && !allowed.test(character) && !source.includes(character));
}
/** Enter is a keyboard label in technical examples, but a verb in these form instructions. */
export const textEntryInstruction = (source) => /\bEnter (?:your|the|a |an |this|[0-9]|code|email|password|text|name|what|details|one|it|manually)/i.test(source);
const nativePatterns = new Map();
export function hasNativeWritingSystem(message, locale) {
  if (!writingSystems[locale]) return false;
  let pattern = nativePatterns.get(locale);
  if (!pattern) {
    pattern = new RegExp(writingSystems[locale].map((name) => `\\p{Script=${name}}`).join("|"), "u");
    nativePatterns.set(locale, pattern);
  }
  return pattern.test(message);
}
