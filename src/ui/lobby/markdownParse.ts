/**
 * The small Markdown the lobby's About text takes (headings, paragraphs, lists, quotes, bold, italic, code and https
 * links), parsed into plain data and drawn as React text by Markdown.tsx: never HTML, so nothing typed can run.
 */
export type Inline = { t: "text"; v: string } | { t: "b" | "i"; c: Inline[] } | { t: "code"; v: string } | { t: "link"; href: string; c: Inline[] };
export type Block = { t: "h"; level: 1 | 2 | 3; c: Inline[] } | { t: "p"; c: Inline[][] } | { t: "ul" | "ol"; items: Inline[][] } | { t: "quote"; c: Inline[][] };

const HEADING = /^(#{1,3})\s+(.*)$/;
const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d{1,3}[.)]\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;
/** `code`, **bold**, *italic* or _italic_, [label](https://…), or a bare https link. */
const INLINE = /`([^`\n]+)`|\*\*([^*\n]+?)\*\*|(?<![\w*])\*([^*\n]+?)\*(?!\w)|(?<!\w)_([^_\n]+?)_(?!\w)|\[([^\]\n]{1,200})\]\((https:\/\/[^\s)]+)\)|(https:\/\/[^\s<>"')\]]+[^\s<>"'.,;:!?)\]])/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ t: "text", v: text.slice(last, at) });
    if (m[1] !== undefined) out.push({ t: "code", v: m[1] });
    else if (m[2] !== undefined) out.push({ t: "b", c: parseInline(m[2]) });
    else if (m[3] !== undefined || m[4] !== undefined) out.push({ t: "i", c: parseInline(m[3] ?? m[4]) });
    else if (m[5] !== undefined) out.push({ t: "link", href: m[6], c: parseInline(m[5]) });
    else out.push({ t: "link", href: m[7], c: [{ t: "text", v: m[7] }] });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ t: "text", v: text.slice(last) });
  return out;
}

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  let i = 0;
  const run = (re: RegExp): string[] => {
    const got: string[] = [];
    while (i < lines.length && re.test(lines[i])) got.push(lines[i++].replace(re, "$1"));
    return got;
  };
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = HEADING.exec(line);
    if (h) {
      blocks.push({ t: "h", level: h[1].length as 1 | 2 | 3, c: parseInline(h[2].trim()) });
      i++;
    } else if (BULLET.test(line)) blocks.push({ t: "ul", items: run(BULLET).map(parseInline) });
    else if (NUMBERED.test(line)) blocks.push({ t: "ol", items: run(NUMBERED).map(parseInline) });
    else if (QUOTE.test(line)) blocks.push({ t: "quote", c: run(QUOTE).map(parseInline) });
    else {
      const para: string[] = [];
      while (i < lines.length && lines[i].trim() && !HEADING.test(lines[i]) && !BULLET.test(lines[i]) && !NUMBERED.test(lines[i]) && !QUOTE.test(lines[i])) para.push(lines[i++]);
      blocks.push({ t: "p", c: para.map(parseInline) });
    }
  }
  return blocks;
}
