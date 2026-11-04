import { countLabel } from "../../i18n/counts";
import { formatUiNumber } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { MeldlingArt } from "../components/MeldlingArt";
import { PenSquare, Search, ScrollText } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Conversation } from "../../api/schemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate, type Section } from "../../application/router";
import type { StoredMessage } from "../../model/types";
import { cleanTitle, filterPosts, guidelinesPreview, MAX_TAGS_PER_POST, MAX_TITLE, postBody, posts, type PostSort, type Post, postText, titleOf, topReaction } from "../../sync/forumRules";
import { UserAvatar } from "../components/OrgAvatar";
import { Dialog } from "../components/Overlay";
import { relative } from "../format";
import type { CollectionCursor } from "../../api/messageCollections";
import type { MessageCollectionPage } from "../../sync/messageCollections";
import { ErrorLine } from "../components/SettingsCard";
import { ImageAttachment } from "./Attachments";
import { isInlineImage, uploadFiles } from "../../sync/attachments";
import { AttachmentDrafts } from "./AttachmentDrafts";
import { inspectFile } from "../../sync/attachmentPolicy";
import { preparePhoto } from "../../sync/photoQuality";
import { channelAbilities } from "../../sync/channelGates";
import { useCommunityAccess, useFeature } from "../community/useCommunityAccess";
import { PARITY_FEATURES } from "../../sync/communityParity";
function forumRows(page: MessageCollectionPage): Post<StoredMessage>[] {
  const roots = new Map(page.messages.map((m) => [m.id, m]));
  return page.threads.flatMap((t) => {
    const root = roots.get(t.rootId);
    return root && !root.deleted ? [{ root, replies: t.replyCount, lastActivity: t.lastReplyTs }] : [];
  });
}
/** How many of the forum's newest messages this browser reads to build the post list. */
const FORUM_WINDOW = 2000;
/** A burst of new posts or replies reloads the list once, this long after the last of them. */
const RELOAD_AFTER_MS = 400;
/**
 * A forum channel (communities, batch B8; android Forum.kt): post guidelines at the top, search, tags (any or all of
 * them), Latest activity or Newest, and cards with each post's title, tags, first lines, replies and top reaction.
 * Opening a post opens its thread. Current servers apply filters and sorting before paging; older servers retain a
 * bounded cache fallback. Media stays on the existing authorized attachment pipeline.
 */
export function ForumView({ c, section }: { c: Conversation; section: Section }) {
  useLocaleRender();
  const engine = useEngine();
  const l10n = useLocalization();
  const users = useOrbit((s) => s.users);
  const live = useOrbit((s) => s.messages[c.id]?.items.length ?? 0);
  const threadRev = useOrbit((s) => s.threadRev);
  const serverPaging = useOrbit((s) => s.server?.features.includes("forum-collections") ?? false);
  const [pageRows, setPageRows] = useState<Post<StoredMessage>[] | null>(null);
  const [cursor, setCursor] = useState<CollectionCursor | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [gallery, setGallery] = useState(false);
  const generation = useRef(0),
    scope = useRef("");
  const moreFlight = useRef(false);
  const [all, setAll] = useState<StoredMessage[] | null>(null);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [matchAll, setMatchAll] = useState(false);
  const [sort, setSort] = useState<PostSort>("latest");
  const [writing, setWriting] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const tagFilter = useMemo(() => [...selected].sort().join(","), [selected]);
  const scopeKey = JSON.stringify([c.id, q.trim(), tagFilter, matchAll, sort]);
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    const requests = generation,
      version = ++requests.current;
    let alive = true;
    const different = scope.current !== scopeKey;
    scope.current = scopeKey;
    if (different) {
      setAll(null);
      setPageRows(null);
      setCursor(null);
    }
    setFailure(null);
    setLoadingMore(false);
    moreFlight.current = false;
    const load = async () => {
      try {
        if (serverPaging) {
          const page = await engine.messageCollection(c.id, "forum", null, undefined, { q, sort, tags: tagFilter, match: matchAll ? "all" : "any" });
          if (alive && version === requests.current) {
            setPageRows(forumRows(page));
            setCursor(page.nextCursor);
          }
        } else {
          const items = await engine.conversationMessages(c.id, FORUM_WINDOW);
          if (alive) setAll(items);
        }
      } catch (error) {
        if (alive) setFailure(error instanceof Error ? error.message : l10n("messaging.interface.couldn_t_post_91176ef"));
      }
    };
    const first = loadedFor.current !== c.id;
    loadedFor.current = c.id;
    const timer = setTimeout(() => void load(), first ? 0 : RELOAD_AFTER_MS);
    return () => {
      alive = false;
      if (requests.current === version) requests.current++;
      clearTimeout(timer);
    };
  }, [engine, c.id, scopeKey, q, sort, tagFilter, matchAll, serverPaging, live, threadRev, attempt, l10n]);
  const loadMore = async () => {
    if (!cursor || moreFlight.current) return;
    const version = generation.current;
    moreFlight.current = true;
    setLoadingMore(true);
    setFailure(null);
    try {
      const page = await engine.messageCollection(c.id, "forum", cursor, undefined, { q, sort, tags: tagFilter, match: matchAll ? "all" : "any" });
      if (version !== generation.current) return;
      setPageRows((rows) => [...new Map([...(rows ?? []), ...forumRows(page)].map((p) => [p.root.id, p])).values()]);
      setCursor(page.nextCursor);
    } catch (error) {
      if (version === generation.current) setFailure(error instanceof Error ? error.message : l10n("messaging.interface.couldn_t_post_91176ef"));
    } finally {
      if (version === generation.current) {
        moreFlight.current = false;
        setLoadingMore(false);
      }
    }
  };
  const list = useMemo(() => {
    if (serverPaging) return pageRows ?? [];
    const items = all ?? [];
    const roots = items.filter((m) => !m.threadRootId && m.kind === "text");
    const replies = new Map<
      string,
      {
        count: number;
        last: number;
      }
    >();
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
  }, [all, sort, q, selected, matchAll, serverPaging, pageRows]);
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
        <section className="forum-guidelines card" aria-label={uiText("messaging.interface.post_guidelines_a4c1d0e")}>
          <h3>
            <Localized k="messaging.interface.post_guidelines_1c3f48f" slots={[<ScrollText size={15} aria-hidden />]} />
          </h3>
          <p>{showGuidelines ? c.guidelines : preview}</p>
          {more && (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowGuidelines(!showGuidelines)}>
              {showGuidelines ? uiText("messaging.interface.show_less_94ea9b1") : uiText("messaging.interface.show_all_2150d8d")}
            </button>
          )}
        </section>
      )}
      <div className="forum-tools">
        <label className="forum-search">
          <Search size={15} aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={uiText("messaging.interface.search_posts_2f810cd")}
            aria-label={uiText("messaging.interface.search_posts_2f810cd")}
            maxLength={200}
          />
        </label>
        <select className="input input-sm" value={sort} onChange={(e) => setSort(e.target.value as PostSort)} aria-label={uiText("messaging.interface.sort_posts_83e975a")}>
          <option value="latest">
            <Localized k="messaging.interface.latest_activity_08ee9e0" />
          </option>
          <option value="newest">
            <Localized k="messaging.interface.newest_d15efa1" />
          </option>
        </select>
        {serverPaging && (
          <div className="segmented" role="group" aria-label={l10n("workspace.forumLayout.label")}>
            <button aria-pressed={!gallery} onClick={() => setGallery(false)}>
              {l10n("workspace.forumLayout.list")}
            </button>
            <button aria-pressed={gallery} onClick={() => setGallery(true)}>
              {l10n("workspace.forumLayout.gallery")}
            </button>
          </div>
        )}
        {c.canPost && (
          <button className="btn btn-primary btn-sm" onClick={() => setWriting(true)}>
            <Localized k="messaging.interface.new_post_f5b4553" slots={[<PenSquare size={15} />]} />
          </button>
        )}
      </div>
      {c.forumTags.length > 0 && (
        <div className="chips" role="group" aria-label={uiText("messaging.interface.filter_by_tag_b927447")}>
          {c.forumTags.map((t) => (
            <button key={t.id} className="chip" aria-pressed={selected.has(t.id)} onClick={() => toggleTag(t.id)}>
              {t.name}
            </button>
          ))}
          {selected.size >= 2 && (
            <button
              className="chip"
              onClick={() => setMatchAll(!matchAll)}
              aria-label={matchAll ? uiText("messaging.interface.showing_posts_with_all_of_these_tags_c9fbf5a") : uiText("messaging.interface.showing_posts_with_any_of_these_tags_2b5fe8d")}
            >
              {matchAll ? uiText("messaging.interface.all_of_these_tags_edee37a") : uiText("messaging.interface.any_of_these_tags_c4f59d4")}
            </button>
          )}
        </div>
      )}
      {failure && (
        <div>
          <ErrorLine text={failure} />
          {!cursor && (
            <button className="btn btn-secondary btn-sm" onClick={() => setAttempt((n) => n + 1)}>
              {l10n("common.actions.retry")}
            </button>
          )}
        </div>
      )}
      {(serverPaging ? pageRows === null : all === null) ? (
        !failure && <span className="skeleton" style={{ height: 120 }} aria-label={l10n("common.status.loading")} />
      ) : list.length === 0 ? (
        <div className="empty" style={{ padding: 32 }}>
          <MeldlingArt pose="hello" />
          <p className="muted">{q || selected.size ? uiText("messaging.interface.no_posts_match_18e7a29") : uiText("messaging.interface.no_posts_yet_start_one_with_new_post_e182bde")}</p>
        </div>
      ) : (
        <ul className={`forum-posts${gallery ? " is-gallery" : ""}`} aria-label={uiText("messaging.interface.posts_a80811c")}>
          {list.map(({ root: m, replies, lastActivity }) => {
            const title = titleOf(m.rich?.title, m.text);
            const body = postBody(m.rich?.title ?? title, m.text);
            const top = topReaction(m.reactions);
            const author = m.outgoing ? uiText("workspace.nav_you") : (users[m.senderUserId]?.displayName ?? uiText("messaging.react_someone"));
            return (
              <li key={m.id}>
                {gallery && m.attachments.find((a) => isInlineImage(a)) && <ImageAttachment r={m.attachments.find((a) => isInlineImage(a))!} />}
                <button className="forum-post card" onClick={() => navigate({ section, conversationId: c.id, panel: "thread", threadRoot: m.id })}>
                  <span className="forum-post-head">
                    <strong className="ellipsis">{title || uiText("messaging.interface.untitled_post_4541948")}</strong>
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
                    <UserAvatar userId={m.senderUserId} name={author} colorIndex={users[m.senderUserId]?.avatarColor ?? 0} photoRev={users[m.senderUserId]?.photoRev} size={18} decorative />
                    <span>{author}</span>
                    <span>· {countLabel(replies, "replies")}</span>
                    <span>· {relative(lastActivity)}</span>
                    {top && (
                      <span className="forum-top-reaction" aria-label={uiText("messaging.interface.value0_reacted_value1_44700f7", { value0: top[1], value1: top[0] })}>
                        {top[0]} {formatUiNumber(top[1])}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {serverPaging && cursor && (
        <button className="btn btn-secondary btn-sm" disabled={loadingMore} onClick={() => void loadMore()}>
          {loadingMore ? l10n("common.status.loading") : failure ? l10n("common.actions.retry") : l10n("messaging.interface.more_d47d7cb")}
        </button>
      )}
      {writing && <NewPostDialog c={c} onClose={() => setWriting(false)} onPosted={(id) => navigate({ section, conversationId: c.id, panel: "thread", threadRoot: id })} />}
    </div>
  );
}
/** New post: a title, the text and up to five of the forum's tags; the guidelines are shown above (B8). */
function NewPostDialog({ c, onClose, onPosted }: { c: Conversation; onClose: () => void; onPosted: (id: string) => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const abilities = channelAbilities(c, useCommunityAccess(c.orgId), useFeature(PARITY_FEATURES.permissions));
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const sending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (sending.current) return;
    const t = cleanTitle(title);
    if (!t) return setError(uiText("messaging.interface.give_your_post_a_title_4be5999"));
    if (c.requireForumTag && tags.length === 0) return setError(l10n("workspace.forumTags.choose"));
    sending.current = true;
    setBusy(true);
    setError(null);
    try {
      const prepared = await Promise.all(files.map(async (file) => preparePhoto(await inspectFile(file), "auto")));
      const attachments = prepared.length
        ? await uploadFiles(
            engine,
            c.id,
            prepared.map((file) => ({ name: file.name, type: file.type, size: file.size, bytes: async () => new Uint8Array(await file.arrayBuffer()) })),
          )
        : [];
      const id = await engine.sendText(c.id, postText(t, body), { rich: { title: t, ...(tags.length ? { tags } : {}) }, ...(attachments.length ? { attachments } : {}) });
      onClose();
      onPosted(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : uiText("messaging.interface.couldn_t_post_91176ef"));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  return (
    <Dialog title={uiText("messaging.interface.new_post_in_value0_9f62084", { value0: c.name ?? uiText("messaging.interface.forum_732d18e") })} onClose={onClose} wide>
      <form className="dialog-body" onSubmit={(e) => void submit(e)} noValidate>
        {c.guidelines && (
          <div className="forum-guidelines card">
            <h3>
              <Localized k="messaging.interface.post_guidelines_1c3f48f" slots={[<ScrollText size={15} aria-hidden />]} />
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
          <label htmlFor="np-title">
            <Localized k="messaging.interface.title_7e8cd20" />
          </label>
          <input id="np-title" className="input" data-autofocus value={title} maxLength={MAX_TITLE} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="np-body">
            <Localized k="messaging.interface.post_a555462" />
          </label>
          <textarea id="np-body" className="textarea" rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        {abilities.attach && (
          <div className="field">
            <label>
              <span>{l10n("common.actions.upload")}</span>
              <input type="file" accept="image/*" disabled={busy} onChange={(e) => setFiles(e.target.files?.[0] ? [e.target.files[0]] : [])} />
            </label>
            <AttachmentDrafts files={files} onRemove={() => setFiles([])} disabled={busy} />
          </div>
        )}
        {c.forumTags.length > 0 && (
          <div className="field">
            <span className="label">
              <Localized k="messaging.interface.tags_up_to_117986f" slots={[MAX_TAGS_PER_POST]} />
            </span>
            <div className="chips">
              {c.forumTags.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  className="chip"
                  aria-pressed={tags.includes(t.id)}
                  disabled={(!abilities.moderate && t.restricted) || (!tags.includes(t.id) && tags.length >= MAX_TAGS_PER_POST)}
                  aria-description={t.restricted ? l10n("workspace.forumTags.restricted") : undefined}
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
            {l10n("common.actions.cancel")}
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? uiText("messaging.interface.posting_648a2ef") : uiText("messaging.interface.post_a555462")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
