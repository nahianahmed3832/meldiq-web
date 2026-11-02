import { Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { expressions, type Expression } from "../../sync/expressions";
import { CustomEmojiImage } from "../community/CustomEmoji";

/** Resolve saved ids against current authorized lists; never persist asset URLs or offer departed/locked assets. */
export function ExpressionLibrary({ source, orgIds, kind, onPick, revision }: { source: string; orgIds: string[]; kind: "emoji" | "sticker"; onPick: (e: Expression) => void; revision: number }) {
  const engine = useEngine();
  const orgs = useOrbit((s) => s.orgs);
  const prefs = useOrbit((s) => s.nav.personal);
  const [loaded, setLoaded] = useState<{ scope: string; items: Expression[]; failed: boolean } | null>(null);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(60);
  useEffect(() => setLimit(60), [source, kind]);
  const [filter, setFilter] = useState<"all" | "favorites" | "recent">("all");
  const [error, setError] = useState<string | null>(null);
  const scope = JSON.stringify(orgIds);
  useEffect(() => {
    let alive = true;
    const ids: string[] = JSON.parse(scope);
    const results: Expression[] = [];
    let failed = false;
    // Bound concurrent requests even for accounts in many communities.
    const load = async () => {
      let next = 0;
      await Promise.all(
        Array.from({ length: Math.min(4, ids.length) }, async () => {
          while (next < ids.length) {
            const id = ids[next++];
            try {
              results.push(...(await expressions(engine, id, true)).expressions.filter((e) => !e.locked));
            } catch {
              failed = true;
            }
          }
        }),
      );
      if (alive) setLoaded({ scope, items: results, failed });
    };
    void load();
    return () => {
      alive = false;
    };
  }, [engine, scope, revision]);
  const favorites = prefs?.expressionFavorites ?? [];
  const recents = prefs?.expressionRecents ?? [];
  const items = loaded?.scope === scope ? loaded.items.filter((e) => e.kind === kind && orgIds.includes(e.orgId) && orgs.some((o) => o.id === e.orgId)) : [];
  const tokens = query.toLowerCase().replace(/[:_]/g, " ").trim().split(/\s+/);
  const shown = items.filter(
    (e) => (!source || e.orgId === source) && (filter === "all" || (filter === "favorites" ? favorites : recents).includes(e.id)) && tokens.every((t) => e.name.replace(/_/g, " ").includes(t)),
  );
  shown.sort((a, b) => (filter === "recent" ? recents.indexOf(a.id) - recents.indexOf(b.id) : a.name.localeCompare(b.name) || a.id.localeCompare(b.id)));
  const write = (fn: Promise<void>) => {
    setError(null);
    void fn.catch(() => setError("Couldn't sync your expressions. Your change will retry when connected."));
  };
  return (
    <section className="xp-library" aria-label="Community expression library">
      <input
        className="input"
        type="search"
        maxLength={60}
        aria-label="Search community expressions"
        placeholder="Search community expressions"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setLimit(60);
        }}
      />
      <div className="segmented" role="group" aria-label="Expression library filter">
        {(["all", "favorites", "recent"] as const).map((f) => (
          <button
            key={f}
            aria-pressed={filter === f}
            onClick={() => {
              setFilter(f);
              setLimit(60);
            }}
          >
            {{ all: "All", favorites: "Favorites", recent: "Recent" }[f]}
          </button>
        ))}
      </div>
      {loaded?.scope !== scope ? (
        <p role="status">Loading expressions…</p>
      ) : (
        <>
          {loaded.failed && <p role="status">Some communities couldn't load. Reopen the picker to retry.</p>}
          {!shown.length && (
            <p className="hint">{filter === "favorites" ? "Star expressions to keep them here." : filter === "recent" ? "Expressions you use appear here." : "No matching expressions."}</p>
          )}
          <div className="xp-library-grid">
            {shown.slice(0, limit).map((e) => (
              <div className="xp-library-item" key={e.id}>
                <button
                  type="button"
                  className="xp-library-pick"
                  aria-label={`${kind === "sticker" ? "Send sticker " : ""}:${e.name}:`}
                  title={`${e.name} · ${orgs.find((o) => o.id === e.orgId)?.name ?? "Community"}`}
                  onClick={() => {
                    write(engine.expressionPreference({ op: "expressionUsed", id: e.id }));
                    onPick(e);
                  }}
                >
                  <LazyExpression expression={e} sticker={kind === "sticker"} />
                  <small className="ellipsis">{e.name}</small>
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`${favorites.includes(e.id) ? "Unfavorite" : "Favorite"} ${e.name}`}
                  aria-pressed={favorites.includes(e.id)}
                  onClick={() => write(engine.expressionPreference({ op: "expressionFavorite", id: e.id, on: !favorites.includes(e.id) }))}
                >
                  <Star size={14} fill={favorites.includes(e.id) ? "currentColor" : "none"} />
                </button>
              </div>
            ))}
          </div>
          {shown.length > limit && (
            <button className="btn btn-secondary btn-sm" onClick={() => setLimit((n) => n + 60)}>
              Load more expressions ({shown.length - limit})
            </button>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

/** Opening the account library must not download every community image. */
function LazyExpression({ expression: e, sticker }: { expression: Expression; sticker: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "60px" },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <span ref={ref} style={{ display: "inline-block", minWidth: sticker ? 54 : 28, minHeight: sticker ? 54 : 28 }}>
      {visible && <CustomEmojiImage id={e.id} name={e.name} sha256={e.sha256} size={28} sticker={sticker} />}
    </span>
  );
}
