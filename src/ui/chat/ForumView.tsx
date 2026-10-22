import { MessageSquare, PenSquare, Search, ScrollText } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Conversation } from "../../api/schemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate, type Section } from "../../application/router";
import type { StoredMessage } from "../../model/types";
import { cleanTitle, filterPosts, guidelinesPreview, MAX_TAGS_PER_POST, MAX_TITLE, postBody, posts, type PostSort, postText, titleOf, topReaction } from "../../sync/forumRules";
import { Avatar } from "../components/Avatar";
import { Dialog } from "../components/Overlay";
import { relative } from "../format";

/** How many of the forum's newest messages this browser reads to build the post list. */
const FORUM_WINDOW = 2000;
/** A burst of new posts or replies reloads the list once, this long after the last of them. */
const RELOAD_AFTER_MS = 400;

/**
 * A forum channel (communities, batch B8; android Forum.kt): post guidelines at the top, search, tags (any or all of
 * them), Latest activity or Newest, and cards with each post's title, tags, first lines, replies and top reaction.
 * Opening a post opens its thread. Everything is read and sorted on this browser: titles and text are encrypted.
 */
export function ForumView({ c, section }: { c: Conversation; section: Section }) {
  const engine = useEngine();
  const users = useOrbit((s) => s.users);
  const live = useOrbit((s) => s.messages[c.id]?.items.length ?? 0);
  const threadRev = useOrbit((s) => s.threadRev);
  const [all, setAll] = useState<StoredMessage[] | null>(null);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [matchAll, setMatchAll] = useState(false);
  const [sort, setSort] = useState<PostSort>("latest");
  const [writing, setWriting] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(false);

  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => void engine.conversationMessages(c.id, FORUM_WINDOW).then((m) => alive && setAll(m));
    // A forum opened just now loads at once; later changes wait for the burst to end instead of rereading every time.
    const first = loadedFor.current !== c.id;
    loadedFor.current = c.id;
    const t = first ? undefined : setTimeout(load, RELOAD_AFTER_MS);
    if (first) load();
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [engine, c.id, live, threadRev]);

  const list = useMemo(() => {
    const items = all ?? [];
    const roots = items.filter((m) => !m.threadRootId && m.kind === "text");
    const replies = new Map<string, { count: number; last: number }>();
    for (const m of items) {
      if (!m.threadRootId || m.deleted) continue;
      const r = replies.get(m.threadRootId) ?? { count: 0, last: 0 };
      replies.set(m.threadRootId, { count: r.count + 1, last: Math.max(r.last, m.sortTs) });
    }
    const sorted = posts(
      roots,
      replies,
      sort,
      (m) => m.id,
      (m) => m.sortTs,
      (m) => !m.deleted,
    );
    return filterPosts(
      sorted,
      q,
      selected,
      (m) => titleOf(m.rich?.title, m.text),
      (m) => m.text,
      (m) => m.rich?.tags ?? [],
      matchAll,
    );
  }, [all, sort, q, selected, matchAll]);

  const tagName = (id: string) => c.forumTags.find((t) => t.id === id)?.name ?? null;
  const [preview, more] = c.guidelines ? guidelinesPreview(c.guidelines) : ["", false];
  const toggleTag = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  return (
    <div className="forum scroll">
      {c.guidelines && (
        <section className="forum-guidelines card" aria-label="Post guidelines">
          <h3>
            <ScrollText size={15} aria-hidden /> Post guidelines
          </h3>
          <p>{showGuidelines ? c.guidelines : preview}</p>
          {more && (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowGuidelines(!showGuidelines)}>
              {showGuidelines ? "Show less" : "Show all"}
            </button>
          )}
        </section>
      )}
      <div className="forum-tools">
        <label className="forum-search">
          <Search size={15} aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search posts" aria-label="Search posts" />
        </label>
        <select className="input input-sm" value={sort} onChange={(e) => setSort(e.target.value as PostSort)} aria-label="Sort posts">
          <option value="latest">Latest activity</option>
          <option value="newest">Newest</option>
        </select>
        {c.canPost && (
          <button className="btn btn-primary btn-sm" onClick={() => setWriting(true)}>
            <PenSquare size={15} /> New post
          </button>
        )}
      </div>
      {c.forumTags.length > 0 && (
        <div className="chips" role="group" aria-label="Filter by tag">
          {c.forumTags.map((t) => (
            <button key={t.id} className="chip" aria-pressed={selected.has(t.id)} onClick={() => toggleTag(t.id)}>
              {t.name}
            </button>
          ))}
          {selected.size >= 2 && (
            <button className="chip" onClick={() => setMatchAll(!matchAll)} aria-label={matchAll ? "Showing posts with all of these tags" : "Showing posts with any of these tags"}>
              {matchAll ? "All of these tags" : "Any of these tags"}
            </button>
          )}
        </div>
      )}
      {all === null ? (
        <span className="skeleton" style={{ height: 120 }} />
      ) : list.length === 0 ? (
        <div className="empty" style={{ padding: 32 }}>
          <span className="empty-orb">
            <MessageSquare size={22} />
          </span>
          <p className="muted">{q || selected.size ? "No posts match." : "No posts on this browser yet. Start one with New post."}</p>
        </div>
      ) : (
        <ul className="forum-posts" aria-label="Posts">
          {list.map(({ root: m, replies, lastActivity }) => {
            const title = titleOf(m.rich?.title, m.text);
            const body = postBody(m.rich?.title ?? title, m.text);
            const top = topReaction(m.reactions);
            const author = m.outgoing ? "You" : (users[m.senderUserId]?.displayName ?? "Someone");
            return (
              <li key={m.id}>
                <button className="forum-post card" onClick={() => navigate({ section, conversationId: c.id, panel: "thread", threadRoot: m.id })}>
                  <span className="forum-post-head">
                    <strong className="ellipsis">{title || "Untitled post"}</strong>
                    {(m.rich?.tags ?? []).map((t) => tagName(t)).filter(Boolean).length > 0 && (
                      <span className="chips">
                        {(m.rich?.tags ?? []).map(
                          (t) =>
                            tagName(t) && (
                              <span key={t} className="chip">
                                {tagName(t)}
                              </span>
                            ),
                        )}
                      </span>
                    )}
                  </span>
                  {body && <span className="forum-post-body">{body.slice(0, 280)}</span>}
                  <span className="forum-post-foot">
                    <Avatar name={author} colorIndex={users[m.senderUserId]?.avatarColor ?? 0} size={18} decorative />
                    <span>{author}</span>
                    <span>· {replies === 1 ? "1 reply" : `${replies} replies`}</span>
                    <span>· {relative(lastActivity)}</span>
                    {top && (
                      <span className="forum-top-reaction" aria-label={`${top[1]} reacted ${top[0]}`}>
                        {top[0]} {top[1]}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {writing && <NewPostDialog c={c} onClose={() => setWriting(false)} onPosted={(id) => navigate({ section, conversationId: c.id, panel: "thread", threadRoot: id })} />}
    </div>
  );
}

/** New post: a title, the text and up to five of the forum's tags; the guidelines are shown above (B8). */
function NewPostDialog({ c, onClose, onPosted }: { c: Conversation; onClose: () => void; onPosted: (id: string) => void }) {
  const engine = useEngine();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = cleanTitle(title);
    if (!t) return setError("Give your post a title.");
    setBusy(true);
    setError(null);
    try {
      const id = await engine.sendText(c.id, postText(t, body), { rich: { title: t, ...(tags.length ? { tags } : {}) } });
      onClose();
      onPosted(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't post.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title={`New post in #${c.name ?? "forum"}`} onClose={onClose} wide>
      <form className="dialog-body" onSubmit={(e) => void submit(e)} noValidate>
        {c.guidelines && (
          <div className="forum-guidelines card">
            <h3>
              <ScrollText size={15} aria-hidden /> Post guidelines
            </h3>
            <p>{c.guidelines}</p>
          </div>
        )}
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <div className="field">
          <label htmlFor="np-title">Title</label>
          <input id="np-title" className="input" data-autofocus value={title} maxLength={MAX_TITLE} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="np-body">Post</label>
          <textarea id="np-body" className="textarea" rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        {c.forumTags.length > 0 && (
          <div className="field">
            <span className="label">Tags (up to {MAX_TAGS_PER_POST})</span>
            <div className="chips">
              {c.forumTags.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  className="chip"
                  aria-pressed={tags.includes(t.id)}
                  disabled={!tags.includes(t.id) && tags.length >= MAX_TAGS_PER_POST}
                  onClick={() => setTags(tags.includes(t.id) ? tags.filter((x) => x !== t.id) : [...tags, t.id])}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Posting…" : "Post"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
