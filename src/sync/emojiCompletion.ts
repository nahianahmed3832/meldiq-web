/** A colon token at the caret, outside code, URLs and words. The complete text remains the draft. */
export function activeEmojiQuery(text: string, caret: number): { start: number; end: number; query: string } | null {
  const prefix = text.slice(0, caret);
  if (prefix.split("```").length % 2 === 0) return null;
  const line = prefix.slice(prefix.lastIndexOf("\n") + 1);
  if ((line.match(/`/g)?.length ?? 0) % 2) return null;
  const match = /(?:^|\s):([a-zA-Z0-9_+-]{0,32})$/.exec(prefix);
  return match ? { start: caret - match[1].length - 1, end: caret, query: match[1].replaceAll("_", " ").toLowerCase() } : null;
}
