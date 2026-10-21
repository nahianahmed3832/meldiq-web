/** What a reaction may be (meldiq docs/EMOJI.md, android EmojiRules): checked on send and on every reaction received. */

/** The same ceiling as the payload schema (protocol/payload.ts); the longest standard emoji is about 35. */
export const REACTION_MAX = 64;
/** Emoji presentation selector: makes a symbol that is also a letter (ℹ, Ⓜ) an emoji. */
const EMOJI_PRESENTATION = 0xfe0f;

/** A reaction is one emoji, not text: no letters (unless shown as emoji), spaces or control characters. */
export function isReaction(value: string | null | undefined): value is string {
  if (!value || value.length > REACTION_MAX) return false;
  const cps = [...value].map((c) => c.codePointAt(0)!);
  return cps.every((cp, i) => {
    const ch = String.fromCodePoint(cp);
    if (/\s/u.test(ch) || /\p{Cc}/u.test(ch)) return false;
    return !/\p{L}/u.test(ch) || cps[i + 1] === EMOJI_PRESENTATION;
  });
}
