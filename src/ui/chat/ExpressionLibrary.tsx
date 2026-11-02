import { Clock, Star } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { expressions, type Expression } from "../../sync/expressions";
import { CustomEmojiImage } from "../community/CustomEmoji";
import { OrgAvatar } from "../components/OrgAvatar";
import { useLongPress } from "./longPress";

/** One authorized library, grouped by community, with the picker's shared search. */
export function ExpressionLibrary({ orgIds, stickers, query, onPick, revision }: { orgIds: string[]; stickers: boolean; query: string; onPick: (e: Expression) => void; revision: number }) {
  const engine = useEngine();
  const orgs = useOrbit((s) => s.orgs);
  const prefs = useOrbit((s) => s.nav.personal);
  const [loaded, setLoaded] = useState<{ scope: string; items: Expression[]; failed: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limits, setLimits] = useState<Record<string, number>>({});
  const scope = JSON.stringify(orgIds);
  useEffect(() => {
    let alive = true;
    const ids: string[] = JSON.parse(scope);
    const items: Expression[] = [];
    let failed = false;
    let next = 0;
    void Promise.all(
      Array.from({ length: Math.min(4, ids.length) }, async () => {
        while (next < ids.length) {
          try {
            items.push(...(await expressions(engine, ids[next++], true)).expressions.filter((e) => !e.locked));
          } catch {
            failed = true;
          }
        }
      }),
    ).then(() => {
      if (alive) setLoaded({ scope, items, failed });
    });
    return () => {
      alive = false;
    };
  }, [engine, scope, revision]);
  useEffect(() => setLimits({}), [query, scope]);
  const favorites = prefs?.expressionFavorites ?? [];
  const recents = prefs?.expressionRecents ?? [];
  const tokens = query.toLowerCase().replace(/[:_]/g, " ").trim().split(/\s+/);
  const items =
    loaded?.scope === scope
      ? loaded.items.filter(
          (e) => (stickers || e.kind === "emoji") && orgIds.includes(e.orgId) && orgs.some((o) => o.id === e.orgId) && tokens.every((token) => e.name.replace(/_/g, " ").includes(token)),
        )
      : [];
  const write = (action: Promise<void>) => {
    setError(null);
    void action.catch(() => setError("Couldn't sync your expressions. Your change will retry when connected."));
  };
  const section = (id: string, title: ReactNode, list: Expression[], label: string) => {
    if (!list.length) return null;
    const limit = limits[id] ?? 60;
    return (
      <section className="xp-expression-group" key={id} aria-label={label}>
        <h3 className="xp-group-heading">{title}</h3>
        <div className="xp-expression-grid">
          {list.slice(0, limit).map((e) => (
            <ExpressionTile
              key={e.id}
              expression={e}
              favorite={favorites.includes(e.id)}
              onFavorite={() => write(engine.expressionPreference({ op: "expressionFavorite", id: e.id, on: !favorites.includes(e.id) }))}
              onPick={() => {
                write(engine.expressionPreference({ op: "expressionUsed", id: e.id }));
                onPick(e);
              }}
            />
          ))}
        </div>
        {list.length > limit && (
          <button className="btn btn-ghost btn-sm" onClick={() => setLimits((current) => ({ ...current, [id]: limit + 60 }))}>
            Show more ({list.length - limit})
          </button>
        )}
      </section>
    );
  };
  return (
    <div className="xp-library" aria-label="Community expressions">
      {loaded?.scope !== scope && (
        <p className="hint" role="status">
          Loading community expressions…
        </p>
      )}
      {loaded?.failed && (
        <p className="hint" role="status">
          Some communities couldn't load. Reopen the picker to retry.
        </p>
      )}
      {section(
        "favorites",
        <>
          <Star size={15} /> Favorites <small>· right-click or hold to unstar</small>
        </>,
        items.filter((e) => favorites.includes(e.id)),
        "Favorites",
      )}
      {!query &&
        section(
          "recent",
          <>
            <Clock size={15} /> Recently used
          </>,
          recents.flatMap((id) => items.filter((e) => e.id === id)).slice(0, 24),
          "Recently used",
        )}
      {orgIds.map((id) => {
        const org = orgs.find((o) => o.id === id);
        return (
          org &&
          section(
            id,
            <>
              <OrgAvatar orgId={id} name={org.name} photoRev={org.photoRev ?? null} size={22} />
              {org.name}
            </>,
            items.filter((e) => e.orgId === id).sort((a, b) => a.name.localeCompare(b.name)),
            org.name,
          )
        );
      })}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

function ExpressionTile({ expression: e, favorite, onFavorite, onPick }: { expression: Expression; favorite: boolean; onFavorite: () => void; onPick: () => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const press = useLongPress(onFavorite, true);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return setVisible(true);
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
    <div className={`xp-expression-tile${favorite ? " favorite" : ""}`}>
      <button
        {...press}
        type="button"
        className="xp-expression-pick"
        aria-label={`${e.kind === "sticker" ? "Send sticker " : ""}:${e.name}:`}
        title={`:${e.name}: · ${e.kind === "sticker" ? "sticker" : e.animated ? "animated emoji" : "emoji"}`}
        onClick={onPick}
      >
        <span ref={ref}>{visible && <CustomEmojiImage id={e.id} name={e.name} sha256={e.sha256} size={32} sticker={e.kind === "sticker"} />}</span>
      </button>
      <button className="xp-favorite" aria-label={`${favorite ? "Unfavorite" : "Favorite"} ${e.name}`} aria-pressed={favorite} onClick={onFavorite}>
        <Star size={12} fill={favorite ? "currentColor" : "none"} />
      </button>
    </div>
  );
}
