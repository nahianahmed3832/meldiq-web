import { isHttpsUrl } from "./embeds";

/**
 * The little markdown a box's text uses (Discord's: bold, italic, underline, strikethrough, code, masked links,
 * headings, lists, quotes and code blocks), read into plain tokens the view draws as React text, never as HTML.
 * Anything it doesn't understand stays as written.
 */

export type Inline = { t: "text"; v: string } | { t: "code"; v: string } | { t: "link"; label: string; url: string } | { t: "bold" | "italic" | "underline" | "strike"; children: Inline[] };

export type Block = { t: "p"; inline: Inline[] } | { t: "h"; level: 1 | 2 | 3; inline: Inline[] } | { t: "li"; inline: Inline[] } | { t: "quote"; inline: Inline[] } | { t: "pre"; v: string };

/** Nested styles beyond this depth stay as text (a hostile post can't make the page recurse deeply). */
const MAX_DEPTH = 4;

const INLINE = /`([^`\n]+)`|\[([^\]\n]{1,256})\]\(([^\s)]{1,2048})\)|\*\*([^\n]+?)\*\*|__([^\n]+?)__|~~([^\n]+?)~~|\*([^*\n]+?)\*|(?<![\p{L}\p{N}])_([^_\n]+?)_(?![\p{L}\p{N}])/gu;

export function parseInline(text: string, depth = 0): Inline[] {
  if (depth >= MAX_DEPTH) return text ? [{ t: "text", v: text }] : [];
  const out: Inline[] = [];
  let at = 0;
  const push = (x: Inline) => {
    const prev = out[out.length - 1];
    if (x.t === "text" && prev?.t === "text") out[out.length - 1] = { t: "text", v: prev.v + x.v };
    else out.push(x);
  };
  for (const m of text.matchAll(INLINE)) {
    const start = m.index ?? 0;
    if (start > at) push({ t: "text", v: text.slice(at, start) });
    at = start + m[0].length;
    const [, code, label, url, bold, underline, strike, star, under] = m;
    if (code !== undefined) push({ t: "code", v: code });
    else if (label !== undefined) push(isHttpsUrl(url) ? { t: "link", label, url } : { t: "text", v: m[0] });
    else if (bold !== undefined) push({ t: "bold", children: parseInline(bold, depth + 1) });
    else if (underline !== undefined) push({ t: "underline", children: parseInline(underline, depth + 1) });
    else if (strike !== undefined) push({ t: "strike", children: parseInline(strike, depth + 1) });
    else push({ t: "italic", children: parseInline(star ?? under ?? "", depth + 1) });
  }
  if (at < text.length) push({ t: "text", v: text.slice(at) });
  return out;
}

const HEADING = /^(#{1,3}) (.+)$/;
const BULLET = /^\s*[-*] (.+)$/;
const QUOTE = /^> ?(.*)$/;
const FENCE = /^```/;

/** The text's blocks: paragraphs keep their line breaks; headings, list items and quotes are a line each. */
export function parseMarkdown(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ t: "p", inline: parseInline(para.join("\n")) });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (FENCE.test(line)) {
      const end = lines.findIndex((l, j) => j > i && FENCE.test(l));
      if (end > i) {
        flush();
        blocks.push({ t: "pre", v: lines.slice(i + 1, end).join("\n") });
        i = end;
        continue;
      }
    }
    const h = HEADING.exec(line);
    const li = BULLET.exec(line);
    const q = QUOTE.exec(line);
    if (h) {
      flush();
      blocks.push({ t: "h", level: h[1].length as 1 | 2 | 3, inline: parseInline(h[2]) });
    } else if (li) {
      flush();
      blocks.push({ t: "li", inline: parseInline(li[1]) });
    } else if (q) {
      flush();
      blocks.push({ t: "quote", inline: parseInline(q[1]) });
    } else if (line.trim() === "") flush();
    else para.push(line);
  }
  flush();
  return blocks;
}
