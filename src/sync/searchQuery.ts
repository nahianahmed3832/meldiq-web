import type { StoredMessage } from "../model/types";

/**
 * Search filters typed in the search box (android SearchQuery, 2026-10-23; Discord's from:, has:, before:, after:).
 * The server finds the words (API 0.57.0, it stores messages); the filters then apply here.
 *
 *   from:bob  from:"Bob Chen"  from:me     a sender (name or @username, any part of it)
 *   has:image  has:video  has:file  has:link
 *   before:2026-10-01  after:2026-10-01   messages before / after that day (the day itself excluded), local time
 */
export const HAS_KINDS = ["image", "video", "file", "link"] as const;
export type HasKind = (typeof HAS_KINDS)[number];

export interface SearchQuery {
  /** The words left to look for in the text (may be empty when filters are set). */
  text: string;
  from: string | null;
  has: HasKind[];
  /** Times in ms: messages strictly before [before] and at or after [after]. */
  before: number | null;
  after: number | null;
}

const TOKEN = /(\w+):("([^"]*)"|\S+)/g;

/** Local midnight at the start of a yyyy-mm-dd day, or null when it isn't one. */
function dayStart(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? d.getTime() : null;
}

export function parseSearchQuery(raw: string): SearchQuery {
  const q: SearchQuery = { text: "", from: null, has: [], before: null, after: null };
  const rest = raw.replace(TOKEN, (whole, key: string, value: string, quoted: string | undefined) => {
    const v = (quoted ?? value).trim();
    switch (key.toLowerCase()) {
      case "from":
        if (!v) return whole;
        q.from = v.replace(/^@/, "").toLowerCase();
        return " ";
      case "has": {
        const kind = HAS_KINDS.find((k) => k === v.toLowerCase());
        if (!kind) return whole;
        if (!q.has.includes(kind)) q.has.push(kind);
        return " ";
      }
      case "before": {
        const t = dayStart(v);
        if (t === null) return whole;
        q.before = t;
        return " ";
      }
      case "after": {
        const t = dayStart(v);
        if (t === null) return whole;
        q.after = t + 86_400_000; // the day after starts after it
        return " ";
      }
      default:
        return whole;
    }
  });
  q.text = rest.replace(/\s+/g, " ").trim();
  return q;
}

/** Whether anything narrows the search besides the text. */
export const hasFilters = (q: SearchQuery): boolean => q.from !== null || q.has.length > 0 || q.before !== null || q.after !== null;

const LINK = /\bhttps?:\/\/\S/i;

function hasKind(m: StoredMessage, kind: HasKind): boolean {
  const files = m.attachments.filter((a) => !a.voice);
  const mime = (a: { mime: string }) => a.mime.toLowerCase();
  if (kind === "image") return files.some((a) => mime(a).startsWith("image/"));
  if (kind === "video") return files.some((a) => mime(a).startsWith("video/"));
  if (kind === "file") return files.some((a) => !mime(a).startsWith("image/") && !mime(a).startsWith("video/"));
  return LINK.test(m.text);
}

/**
 * Whether [m] matches [q]. [sender] names who sent it: display name and @username, and whether it's this account (for
 * from:me).
 */
export function matchesSearch(m: StoredMessage, q: SearchQuery, sender: (m: StoredMessage) => { name: string; username: string; me: boolean }): boolean {
  if (m.deleted || m.kind !== "text") return false;
  if (q.text && !m.text.toLowerCase().includes(q.text.toLowerCase())) return false;
  if (q.before !== null && m.sortTs >= q.before) return false;
  if (q.after !== null && m.sortTs < q.after) return false;
  if (q.from !== null) {
    const s = sender(m);
    const mine = q.from === "me" || q.from === "you";
    if (mine ? !s.me : !s.name.toLowerCase().includes(q.from) && !s.username.toLowerCase().includes(q.from)) return false;
  }
  return q.has.every((k) => hasKind(m, k));
}
