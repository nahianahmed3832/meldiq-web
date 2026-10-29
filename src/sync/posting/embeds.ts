/**
 * What a post from a webhook or one of the community's own senders (Tickets) carries besides its text (server
 * docs/COMMUNITY_PARITY_API.md › Posting tools › Message payload fields): boxes (Discord's embeds), buttons, and the
 * webhook that posted it. It arrives in a message payload, so it's cleaned like any untrusted input: bounded, links and
 * pictures only https:// with no credentials, anything unusable dropped rather than failing the whole message.
 */

export const POST_LIMITS = {
  embeds: 10,
  title: 256,
  description: 4096,
  authorName: 256,
  footer: 2048,
  buttons: 5,
  buttonLabel: 80,
  emoji: 64,
  url: 2048,
  webhookName: 80,
  id: 64,
} as const;

export interface Embed {
  title?: string;
  description?: string;
  url?: string;
  /** 0xRRGGBB. */
  color?: number;
  author?: string;
  image?: string;
  thumbnail?: string;
  footer?: string;
}

export type TicketAction = "open_ticket" | "close_ticket";

export type PostButton =
  { kind: "link"; label: string | null; emoji: string | null; url: string } | { kind: "action"; action: TicketAction; label: string | null; emoji: string | null; panelId: string | null };

export interface PostWebhook {
  id: string;
  name: string;
  /** The webhook's own picture's revision (fetched with the session), or null for the standard picture. */
  avatarRev: number | null;
}

/** An https:// address with a host and no credentials (the server's isHttpsUrl): nothing else becomes a link or picture. */
export function isHttpsUrl(v: string): boolean {
  if (v.length > POST_LIMITS.url || /\s/.test(v)) return false;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && !!u.hostname && !u.username && !u.password;
  } catch {
    return false;
  }
}

/** Text without control or direction-changing characters (newlines and tabs stay), cut to [max] characters. */
function safeText(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  // eslint-disable-next-line no-control-regex
  const cleaned = v.replace(/[\u0000-\u0008\u000b-\u001f\u007f‪-‮⁦-⁩]/g, "").trim();
  return cleaned ? [...cleaned].slice(0, max).join("") : undefined;
}

function safeUrl(v: unknown): string | undefined {
  return typeof v === "string" && isHttpsUrl(v) ? v : undefined;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** [key] of an object ({ name } of an author, { url } of a picture), or undefined. */
function nested(v: unknown, key: string): unknown {
  return isRecord(v) ? v[key] : undefined;
}

function cleanColor(v: unknown): number | undefined {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 0xffffff ? v : undefined;
}

/** One box, or null when nothing in it can be shown. */
export function cleanEmbed(raw: unknown): Embed | null {
  if (!isRecord(raw)) return null;
  const r = raw;
  const e: Embed = {};
  const title = safeText(r.title, POST_LIMITS.title);
  if (title) e.title = title;
  const description = safeText(r.description, POST_LIMITS.description);
  if (description) e.description = description;
  const url = safeUrl(r.url);
  if (url) e.url = url;
  const color = cleanColor(r.color);
  if (color !== undefined) e.color = color;
  const author = safeText(nested(r.author, "name"), POST_LIMITS.authorName);
  if (author) e.author = author;
  const image = safeUrl(nested(r.image, "url"));
  if (image) e.image = image;
  const thumbnail = safeUrl(nested(r.thumbnail, "url"));
  if (thumbnail) e.thumbnail = thumbnail;
  const footer = safeText(nested(r.footer, "text"), POST_LIMITS.footer);
  if (footer) e.footer = footer;
  const shows = e.title || e.description || e.author || e.image || e.thumbnail || e.footer;
  return shows ? e : null;
}

export function cleanEmbeds(raw: unknown): Embed[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, POST_LIMITS.embeds)
    .map(cleanEmbed)
    .filter((e): e is Embed => e !== null);
}

const ID = /^[A-Za-z0-9_-]{1,64}$/;

/** One button, or null: a link needs an https address, an action a known one; each needs a label or an emoji. */
export function cleanButton(raw: unknown): PostButton | null {
  if (!isRecord(raw)) return null;
  const r = raw;
  const label = safeText(r.label, POST_LIMITS.buttonLabel) ?? null;
  const emoji = safeText(r.emoji, POST_LIMITS.emoji) ?? null;
  if (!label && !emoji) return null;
  if (r.kind === "link") {
    const url = safeUrl(r.url);
    return url ? { kind: "link", label, emoji, url } : null;
  }
  if (r.kind === "action" && (r.action === "open_ticket" || r.action === "close_ticket")) {
    const panelId = typeof r.panelId === "string" && ID.test(r.panelId) ? r.panelId : null;
    return { kind: "action", action: r.action, label, emoji, panelId };
  }
  return null;
}

export function cleanButtons(raw: unknown): PostButton[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, POST_LIMITS.buttons)
    .map(cleanButton)
    .filter((b): b is PostButton => b !== null);
}

/**
 * The webhook that posted: its id, a name (the poster may override it) and its picture. Only the server's own picture
 * address (`/v1/webhooks/<id>/avatar?rev=N`) is kept: an outside picture (the poster's override) isn't fetched, so the
 * standard picture shows instead, as the app never loads pictures from other sites.
 */
export function cleanWebhook(raw: unknown): PostWebhook | null {
  if (!isRecord(raw)) return null;
  const r = raw;
  if (typeof r.id !== "string" || !ID.test(r.id)) return null;
  const name = safeText(r.name, POST_LIMITS.webhookName);
  if (!name) return null;
  return { id: r.id, name, avatarRev: avatarRevOf(r.avatarUrl, r.id) };
}

const AVATAR_PATH = /^\/v1\/webhooks\/([A-Za-z0-9_-]{1,64})\/avatar\?rev=(\d{1,15})$/;

/** The revision in the server's picture address for webhook [id], or null for anything else. */
export function avatarRevOf(avatarUrl: unknown, id: string): number | null {
  if (typeof avatarUrl !== "string") return null;
  const m = AVATAR_PATH.exec(avatarUrl);
  if (!m || m[1] !== id) return null;
  const rev = Number(m[2]);
  return Number.isSafeInteger(rev) && rev > 0 ? rev : null;
}

/** "#rrggbb" for a box's colour bar; null without one (the theme's line colour). */
export function colorHex(color: number | undefined): string | null {
  if (color === undefined || !Number.isInteger(color) || color < 0 || color > 0xffffff) return null;
  return `#${color.toString(16).padStart(6, "0")}`;
}

/** What a button says: its emoji and label, or a stand-in for an action with neither. */
export function buttonText(b: PostButton): string {
  const text = [b.emoji, b.label].filter(Boolean).join(" ");
  if (text) return text;
  return b.kind === "action" ? (b.action === "open_ticket" ? "Open a ticket" : "Close ticket") : "Open link";
}
