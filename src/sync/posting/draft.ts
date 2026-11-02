import { cleanButtons, cleanEmbeds, type Embed, isHttpsUrl, type PostButton } from "./embeds";

/**
 * "Make a post" (the reference's embed builder): text above the boxes, up to 10 boxes and 5 link buttons, posted through
 * a webhook. The draft is what the form edits; it becomes the JSON Discord's webhooks take (the server's
 * WebhookMessageBody), and that JSON can be copied out and pasted back in.
 */

export const DRAFT_LIMITS = {
  content: 2000,
  boxes: 10,
  title: 256,
  description: 4096,
  author: 256,
  footer: 2048,
  /** Every box's text together, as Discord counts it. */
  allBoxes: 6000,
  buttons: 5,
  buttonLabel: 80,
  emoji: 64,
  threadName: 100,
  /** A pasted JSON larger than this isn't read. */
  json: 100_000,
} as const;

export interface DraftBox {
  key: string;
  /** "#rrggbb", or "" for no colour. */
  color: string;
  title: string;
  description: string;
  url: string;
  author: string;
  image: string;
  thumbnail: string;
  footer: string;
}

export interface DraftButton {
  key: string;
  emoji: string;
  label: string;
  url: string;
}

export interface PostDraft {
  content: string;
  boxes: DraftBox[];
  buttons: DraftButton[];
  /** A forum post's title (required in a forum channel). */
  threadName: string;
}

/** The JSON the webhook's address and "Make a post" take (Discord's execute-webhook body, plus simple buttons). */
export interface WebhookBody {
  content?: string;
  embeds?: {
    title?: string;
    description?: string;
    url?: string;
    color?: number;
    author?: { name: string };
    image?: { url: string };
    thumbnail?: { url: string };
    footer?: { text: string };
  }[];
  buttons?: { label?: string; emoji?: string; url: string }[];
  thread_name?: string;
}

let counter = 0;
const nextKey = (what: string) => `${what}-${++counter}`;

export function emptyBox(color = ""): DraftBox {
  return { key: nextKey("box"), color, title: "", description: "", url: "", author: "", image: "", thumbnail: "", footer: "" };
}

export function emptyButton(): DraftButton {
  return { key: nextKey("button"), emoji: "", label: "", url: "" };
}

/** The reference's starting point: a welcome box, a rules box, and two link buttons to fill in. */
export function sampleDraft(community: string): PostDraft {
  return {
    content: "",
    boxes: [
      { ...emptyBox("#5865f2"), title: `Welcome to ${community}!`, description: "Say hi in the chat and make yourself at home." },
      { ...emptyBox("#f0b232"), title: "Rules", description: "1. Be kind.\n2. No spam.\n3. Keep it on topic." },
    ],
    buttons: [
      { ...emptyButton(), emoji: "📜", label: "Terms", url: "https://example.com/terms" },
      { ...emptyButton(), emoji: "🛡️", label: "Guidelines", url: "https://example.com/guidelines" },
    ],
    threadName: "",
  };
}

const HEX = /^#?([0-9a-fA-F]{6})$/;

/** A colour field to the number the JSON carries; undefined when empty or not a colour. */
export function colorNumber(color: string): number | undefined {
  const m = HEX.exec(color.trim());
  return m ? parseInt(m[1], 16) : undefined;
}

const set = (s: string) => s.trim() || undefined;

/** The draft as the JSON the server takes: only what's filled in. */
export function toWebhookBody(d: PostDraft): WebhookBody {
  const body: WebhookBody = {};
  const content = set(d.content);
  if (content) body.content = content;
  const embeds = d.boxes
    .map((b) => {
      const e: NonNullable<WebhookBody["embeds"]>[number] = {};
      if (set(b.title)) e.title = b.title.trim();
      if (set(b.description)) e.description = b.description.trim();
      if (set(b.url)) e.url = b.url.trim();
      const color = colorNumber(b.color);
      if (color !== undefined) e.color = color;
      if (set(b.author)) e.author = { name: b.author.trim() };
      if (set(b.image)) e.image = { url: b.image.trim() };
      if (set(b.thumbnail)) e.thumbnail = { url: b.thumbnail.trim() };
      if (set(b.footer)) e.footer = { text: b.footer.trim() };
      return e;
    })
    .filter((e) => Object.keys(e).length > 0);
  if (embeds.length) body.embeds = embeds;
  const buttons = d.buttons
    .filter((b) => set(b.url) || set(b.label) || set(b.emoji))
    .map((b) => ({ ...(set(b.label) ? { label: b.label.trim() } : {}), ...(set(b.emoji) ? { emoji: b.emoji.trim() } : {}), url: b.url.trim() }));
  if (buttons.length) body.buttons = buttons;
  const thread = set(d.threadName);
  if (thread) body.thread_name = thread;
  return body;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const field = (v: unknown, key: string): string => (v && typeof v === "object" && !Array.isArray(v) ? str((v as Record<string, unknown>)[key]) : "");

function colorText(v: unknown): string {
  if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 0xffffff) return `#${v.toString(16).padStart(6, "0")}`;
  const m = typeof v === "string" ? HEX.exec(v.trim()) : null;
  return m ? `#${m[1].toLowerCase()}` : "";
}

/** Link buttons from Meldiq's `buttons` and Discord's `components` (action rows of link buttons). */
function buttonsOf(raw: Record<string, unknown>): DraftButton[] {
  const simple = Array.isArray(raw.buttons) ? raw.buttons : [];
  const rows = Array.isArray(raw.components) ? raw.components : [];
  const fromRows = rows.flatMap((row) => {
    const parts = row && typeof row === "object" ? (row as Record<string, unknown>).components : null;
    return Array.isArray(parts) ? parts.filter((c) => c && typeof c === "object" && (c as Record<string, unknown>).style === 5) : [];
  });
  return [...simple, ...fromRows].map((b) => {
    const r = (b && typeof b === "object" ? b : {}) as Record<string, unknown>;
    const emoji = typeof r.emoji === "string" ? r.emoji : field(r.emoji, "name");
    return { ...emptyButton(), emoji, label: str(r.label), url: str(r.url) };
  });
}

/**
 * A pasted JSON (this builder's own, or a Discord webhook message) as a draft; an error to show when it can't be read.
 * Boxes and buttons beyond the limits are left out; draftProblems() points at anything else.
 */
export function draftFromJson(text: string): { draft: PostDraft } | { error: string } {
  if (text.length > DRAFT_LIMITS.json) return { error: "That JSON is too long." };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: "That isn't valid JSON." };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { error: 'The JSON should be an object, like { "content": "Hi" }.' };
  const r = raw as Record<string, unknown>;
  const embeds = Array.isArray(r.embeds) ? r.embeds : [];
  const boxes = embeds.slice(0, DRAFT_LIMITS.boxes).map((e) => {
    const x = (e && typeof e === "object" ? e : {}) as Record<string, unknown>;
    return {
      ...emptyBox(colorText(x.color)),
      title: str(x.title),
      description: str(x.description),
      url: str(x.url),
      author: field(x.author, "name"),
      image: field(x.image, "url"),
      thumbnail: field(x.thumbnail, "url"),
      footer: field(x.footer, "text"),
    };
  });
  return { draft: { content: str(r.content), boxes, buttons: buttonsOf(r).slice(0, DRAFT_LIMITS.buttons), threadName: str(r.thread_name) } };
}

/** The draft as pretty JSON, for Copy JSON. */
export function draftToJson(d: PostDraft): string {
  return JSON.stringify(toWebhookBody(d), null, 2);
}

const chars = (s: string) => [...s.trim()].length;

function boxProblems(b: DraftBox, n: number): string[] {
  const out: string[] = [];
  const name = `Box ${n}`;
  if (chars(b.title) > DRAFT_LIMITS.title) out.push(`${name}: the title is over ${DRAFT_LIMITS.title} characters.`);
  if (chars(b.description) > DRAFT_LIMITS.description) out.push(`${name}: the text is over ${DRAFT_LIMITS.description} characters.`);
  if (chars(b.author) > DRAFT_LIMITS.author) out.push(`${name}: the author line is over ${DRAFT_LIMITS.author} characters.`);
  if (chars(b.footer) > DRAFT_LIMITS.footer) out.push(`${name}: the footer is over ${DRAFT_LIMITS.footer} characters.`);
  if (b.color.trim() && colorNumber(b.color) === undefined) out.push(`${name}: the colour should look like #5865f2.`);
  const links: [string, string][] = [
    [b.url, "title link"],
    [b.image, "big picture"],
    [b.thumbnail, "small picture"],
  ];
  for (const [url, what] of links) if (url.trim() && !isHttpsUrl(url.trim())) out.push(`${name}: the ${what} needs an https:// address.`);
  return out;
}

function buttonProblems(b: DraftButton, n: number): string[] {
  const out: string[] = [];
  if (!b.label.trim() && !b.emoji.trim()) out.push(`Button ${n}: give it a label or an emoji.`);
  if (chars(b.label) > DRAFT_LIMITS.buttonLabel) out.push(`Button ${n}: the label is over ${DRAFT_LIMITS.buttonLabel} characters.`);
  if (!isHttpsUrl(b.url.trim())) out.push(`Button ${n}: it needs an https:// address.`);
  return out;
}

/** What stops the draft from posting, in the form's order; empty when it can go. [forum]: a title is required. */
export function draftProblems(d: PostDraft, forum: boolean): string[] {
  const out: string[] = [];
  const body = toWebhookBody(d);
  if (!body.content && !body.embeds?.length) out.push("Write some text or fill in a box.");
  if (forum && !d.threadName.trim()) out.push("A forum post needs a title.");
  if (chars(d.threadName) > DRAFT_LIMITS.threadName) out.push(`The title is over ${DRAFT_LIMITS.threadName} characters.`);
  if (chars(d.content) > DRAFT_LIMITS.content) out.push(`The text above the boxes is over ${DRAFT_LIMITS.content} characters.`);
  if (d.boxes.length > DRAFT_LIMITS.boxes) out.push(`A post holds ${DRAFT_LIMITS.boxes} boxes at most.`);
  d.boxes.forEach((b, i) => out.push(...boxProblems(b, i + 1)));
  const total = d.boxes.reduce((n, b) => n + chars(b.title) + chars(b.description) + chars(b.author) + chars(b.footer), 0);
  if (total > DRAFT_LIMITS.allBoxes) out.push(`All the boxes together are over ${DRAFT_LIMITS.allBoxes} characters.`);
  if (d.buttons.length > DRAFT_LIMITS.buttons) out.push(`A post holds ${DRAFT_LIMITS.buttons} buttons at most.`);
  d.buttons.forEach((b, i) => out.push(...buttonProblems(b, i + 1)));
  return out;
}

/** What the post will look like, through the same cleaning a received post goes through. */
export function draftPreview(d: PostDraft): { embeds: Embed[]; buttons: PostButton[] } {
  const body = toWebhookBody(d);
  return {
    embeds: cleanEmbeds(body.embeds ?? []),
    buttons: cleanButtons((body.buttons ?? []).map((b) => ({ kind: "link", label: b.label ?? null, emoji: b.emoji ?? null, url: b.url }))),
  };
}

/** Moves item [i] one place up (-1) or down (+1); the same list when it can't move. */
export function moved<T>(list: readonly T[], i: number, by: -1 | 1): T[] {
  const j = i + by;
  if (i < 0 || i >= list.length || j < 0 || j >= list.length) return [...list];
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
