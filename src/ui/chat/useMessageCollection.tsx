import { useEffect, useRef, useState } from "react";
import type { CollectionCursor, CollectionKind } from "../../api/messageCollections";
import { useEngine, useOrbit } from "../../application/orbit";
import type { MessageCollectionPage } from "../../sync/messageCollections";
import { threadRows } from "../../sync/threads";
import { useT } from "../../i18n";

/** One bounded page and lightweight cursor history; stale requests cannot replace another conversation's page. */
export function useMessageCollection(conversationId: string, kind: CollectionKind, root?: string) {
  const engine = useEngine();
  const supported = useOrbit((s) => s.server?.features.includes("message-collections") ?? false);
  const revision = useOrbit((s) => `${s.collectionRev}:` + (s.messages[conversationId]?.items ?? []).map((m) => `${m.id}:${m.deleted}:${m.pinned}:${m.editedAt}`).join("|"));
  const [cursors, setCursors] = useState<(CollectionCursor | null)[]>([null]);
  const [page, setPage] = useState<MessageCollectionPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const gen = useRef(0);
  const key = `${conversationId}:${kind}:${root ?? ""}:${supported}`;
  const currentKey = useRef(key);
  const cursor = cursors.at(-1) ?? null;
  useEffect(() => {
    // Reset before fetching: the old cursor belongs to the previous conversation or collection.
    if (currentKey.current !== key) {
      currentKey.current = key;
      setCursors([null]);
      setPage(null);
      if (cursor) return;
    }
    let alive = true;
    const mine = ++gen.current;
    setLoading(true);
    setError(null);
    const load = async (): Promise<MessageCollectionPage> => {
      if (supported) return engine.messageCollection(conversationId, kind, cursor, root);
      const messages = kind === "pins" ? await engine.pinnedMessages(conversationId) : await engine.conversationMessages(conversationId, 5000);
      return {
        messages: kind === "thread" ? messages.filter((m) => m.threadRootId === root) : messages,
        context: kind === "thread" ? messages.filter((m) => m.id === root) : [],
        threads: kind === "threads" ? threadRows(messages).map((r) => ({ rootId: r.rootId, replyCount: r.replies, lastReplyTs: r.lastReplyTs })) : [],
        more: false,
        nextCursor: null,
      };
    };
    void load()
      .then((p) => {
        if (alive && mine === gen.current) setPage(p);
      })
      .catch((e: unknown) => {
        if (alive && mine === gen.current) {
          setPage(null);
          setError(e instanceof Error ? e.message : "Couldn't load messages. Try again.");
        }
      })
      .finally(() => {
        if (alive && mine === gen.current) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [engine, conversationId, kind, root, supported, cursor, key, revision, tick]);
  return {
    page,
    error,
    loading,
    supported,
    pageNumber: cursors.length,
    refresh: () => setTick((n) => n + 1),
    previous:
      cursors.length > 1
        ? () => {
            setPage(null);
            setCursors((s) => s.slice(0, -1));
          }
        : null,
    next: page?.nextCursor
      ? () => {
          setPage(null);
          setCursors((s) => [...s, page.nextCursor]);
        }
      : null,
  };
}

export function CollectionControls({ collection }: { collection: ReturnType<typeof useMessageCollection> }) {
  const t = useT();
  const { error, loading, supported, pageNumber, previous, next, refresh } = collection;
  return (
    <div className="collection-controls" aria-label={t("collection_pages")} aria-busy={loading}>
      {!supported && <p className="faint">{t("collection_cached")}</p>}
      {error && (
        <p className="banner danger" role="alert">
          {error}
        </p>
      )}
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        {supported && (
          <>
            <button className="btn btn-secondary btn-sm" disabled={loading || !previous} onClick={() => previous?.()}>
              {t("collection_previous")}
            </button>
            <span className="faint" role="status">
              {t("collection_page", { page: pageNumber })}
            </span>
            <button className="btn btn-secondary btn-sm" disabled={loading || !next} onClick={() => next?.()}>
              {t("collection_next")}
            </button>
          </>
        )}
        <button className="btn btn-ghost btn-sm" disabled={loading} onClick={refresh}>
          {t(loading ? "collection_loading" : "collection_refresh")}
        </button>
      </div>
    </div>
  );
}
