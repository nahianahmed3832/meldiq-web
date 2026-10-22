/**
 * Forum channels (communities, batch B8; android ForumRules.kt): posts are messages with a title, their replies the
 * existing threads. Titles, text and tags are inside the encrypted message, so sorting, searching and filtering happen
 * on this browser. Pure and tested with the phone's cases (test/forum-rules.test.ts).
 */
export const MAX_TITLE = 120;
export const MAX_TAGS_PER_POST = 5;
export const MAX_FORUM_TAGS = 20;
export const MAX_TAG_NAME = 20;
const TAG_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** A post's tag ids as received: well-formed, distinct, at most five. */
export function cleanTags(ids: readonly string[] | null | undefined): string[] {
  return [...new Set((ids ?? []).filter((t) => TAG_ID.test(t)))].slice(0, MAX_TAGS_PER_POST);
}

/** A forum's tag names as a manager typed them: trimmed, bounded, no empty or repeated (case-insensitive) names. */
export function cleanTagNames(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    const t = n.replace(/\s+/g, " ").trim().slice(0, MAX_TAG_NAME);
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out.slice(0, MAX_FORUM_TAGS);
}

/** A received or typed title: one line, trimmed, bounded; null when nothing is left. */
export function cleanTitle(t: string | null | undefined): string | null {
  const s = (t ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_TITLE);
  return s || null;
}

/** What a post sends as its text: the title, a blank line and the body, so apps without forums still show both. */
export const postText = (title: string, body: string): string => [title.trim(), body.trim()].filter(Boolean).join("\n\n");

/** The body to show under a post's [title]: its text without the leading title line. */
export function postBody(title: string | null, text: string): string {
  if (!title) return text;
  return text.startsWith(title) ? text.slice(title.length).replace(/^[\n ]+/, "") : text;
}

/** A post's title: the one it was sent with, or its first line for messages sent before the channel was a forum. */
export function titleOf(title: string | null | undefined, text: string): string {
  return cleanTitle(title) ?? cleanTitle(text.split("\n")[0]) ?? "";
}

export interface Post<T> {
  root: T;
  replies: number;
  lastActivity: number;
}
export type PostSort = "latest" | "newest";

/** A forum's posts from its top-level messages and their threads' replies, newest first by [sort]. */
export function posts<T>(
  roots: readonly T[],
  replies: ReadonlyMap<string, { count: number; last: number }>,
  sort: PostSort,
  id: (t: T) => string,
  time: (t: T) => number,
  visible: (t: T) => boolean = () => true,
): Post<T>[] {
  return roots
    .filter(visible)
    .map((m) => {
      const r = replies.get(id(m));
      return { root: m, replies: r?.count ?? 0, lastActivity: Math.max(time(m), r?.last ?? 0) };
    })
    .sort((a, b) => (sort === "latest" ? b.lastActivity - a.lastActivity : time(b.root) - time(a.root)));
}

/** Posts for a search [query] (title and text) and [selected] tags: any of them, or all with [matchAll] (B8). */
export function filterPosts<T>(
  list: readonly Post<T>[],
  query: string,
  selected: ReadonlySet<string>,
  title: (t: T) => string,
  body: (t: T) => string,
  tags: (t: T) => string[],
  matchAll = false,
): Post<T>[] {
  const q = query.trim().toLowerCase();
  return list.filter((p) => {
    const t = tags(p.root);
    const textOk = !q || title(p.root).toLowerCase().includes(q) || body(p.root).toLowerCase().includes(q);
    const tagOk = selected.size === 0 || (matchAll ? [...selected].every((s) => t.includes(s)) : t.some((x) => selected.has(x)));
    return textOk && tagOk;
  });
}

/** A post card's most-used reaction and how many people used it (B8); null without any. */
export function topReaction(reactions: Record<string, readonly string[]>): [string, number] | null {
  const counts = Object.entries(reactions)
    .map(([e, users]) => [e, new Set(users).size] as [string, number])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return counts[0] ?? null;
}

/** Guidelines as the forum shows them collapsed: the first lines, and whether there's more. */
export function guidelinesPreview(text: string, lines = 3): [string, boolean] {
  const all = text.trim().split("\n");
  return [all.slice(0, lines).join("\n"), all.length > lines];
}
