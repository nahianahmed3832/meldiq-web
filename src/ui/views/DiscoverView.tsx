import { Compass, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../api/client";
import type { Discovered } from "../../api/communitySchemas";
import type { DiscoverCard } from "../../api/discoverySchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { useT } from "../../i18n";
import { discover } from "../../sync/community";
import { discoverListing, recordDiscoverClick, type DiscoverQuery, type DiscoverSize, type DiscoverSort } from "../../sync/discovery/api";
import { appendPage, DISCOVERY_FEATURES } from "../../sync/discovery/rules";
import type { Engine } from "../../sync/engine";
import { Icon } from "../icons/Icon";
import { CommunityPreviewDialog } from "../community/CommunityPreviewDialog";
import { DiscoverCommunityCard } from "./DiscoverCard";

/** How long typing pauses before the search runs. */
const SEARCH_DELAY_MS = 300;
const FEATURED_TAGS = ["gaming", "roblox", "art", "music", "minecraft", "anime", "bot", "vc"];
const EXTRA_TAGS = ["community", "design", "education", "technology"];


function matchesSize(memberCount: number, size: DiscoverSize): boolean {
  if (size === "small") return memberCount < 100;
  if (size === "medium") return memberCount >= 100 && memberCount < 1000;
  if (size === "large") return memberCount >= 1000;
  return true;
}

interface Page {
  promoted: DiscoverCard[];
  communities: DiscoverCard[];
  nextCursor: number | null;
}

/** An older server's card (GET /v1/communities/discover): no tags, label or online count. */
const asCard = (c: Discovered): DiscoverCard => ({ ...c, tags: [], onlineCount: 0, label: null, official: false });

/** One page of Discover: the server's listing with discovery-listing, else the older list (no Promoted row). */
async function loadPage(engine: Engine, v2: boolean, query: DiscoverQuery): Promise<Page> {
  if (v2) return discoverListing(engine, query);
  const p = await discover(engine, query.q ?? "", query.cursor ?? 0);
  return { promoted: [], communities: p.communities.map(asCard), nextCursor: p.nextCursor };
}

/**
 * Discover (community-first brief §3B, the reference's Discover page; community parity E): public communities from the
 * server, searched as you type. With discovery-listing, a Promoted row of up to 4 communities (PROMOTED tag) comes
 * first, then every listed community (boosted ones first, with their labels), tags that filter the list, and who's
 * online; opening a card is counted for its Promoted week. Nothing is invented: every card is what the server says.
 */
export function DiscoverView({ onSearch }: { onSearch: () => void }) {
  const engine = useEngine();
  const t = useT();
  const v2 = useOrbit((s) => s.server?.features.includes(DISCOVERY_FEATURES.listing) ?? false);
  const sortable = useOrbit((s) => s.server?.features.includes("discovery-sort") ?? false);
  const [sort, setSort] = useState<DiscoverSort>("recommended");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [size, setSize] = useState<DiscoverSize>("any");
  const [loadingMore, setLoadingMore] = useState(false);
  const generation = useRef(0);
  const [page, setPage] = useState<Page | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setQuery(q.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    let live = true;
    generation.current++;
    setLoadingMore(false);
    setPage(null);
    setError(null);
    loadPage(engine, v2, { q: query, tag, ...(sortable ? { size, sort } : {}) })
      .then((p) => live && setPage(p))
      // The server's own message, or "" for the generic one (worded at render: t isn't a stable dependency).
      .catch((e: unknown) => live && setError(errorText(e)));
    return () => {
      live = false;
    };
  }, [engine, v2, query, tag, size, sort, sortable, attempt]);

  const more = async () => {
    if (page?.nextCursor == null || loadingMore) return;
    const active = generation.current;
    setLoadingMore(true);
    try {
      const p = await loadPage(engine, v2, { q: query, tag, cursor: page.nextCursor, ...(sortable ? { size, sort } : {}) });
      if (active !== generation.current) return;
      setPage((cur) => (cur ? { ...cur, communities: appendPage(cur.communities, p.communities), nextCursor: p.nextCursor } : cur));
    } catch (e) {
      if (active === generation.current) setError(errorText(e));
    } finally {
      if (active === generation.current) setLoadingMore(false);
    }
  };

  const openPreview = (id: string) => {
    if (v2) void recordDiscoverClick(engine, id);
    setPreview(id);
  };
  const joined = (id: string) => setPage((p) => (p ? { ...p, promoted: markJoined(p.promoted, id), communities: markJoined(p.communities, id) } : p));
  const filtered = !!query || !!tag || size !== "any";
  const list = page?.communities.filter((c) => sortable || matchesSize(c.memberCount, size)) ?? null;
  const promoted = page?.promoted.filter((c) => sortable || matchesSize(c.memberCount, size)) ?? [];
  const card = (c: DiscoverCard) => <DiscoverCommunityCard c={c} onPreview={() => openPreview(c.id)} onJoined={joined} onTag={v2 ? setTag : undefined} />;

  return (
    <section className="main" aria-label={t("discover_title")}>
      <header className="conv-head discover-head">
        <Icon name="navigation.discover" size={18} />
        <h1 className="grow">{t("discover_title")}</h1>
        <button className="btn btn-secondary btn-sm" onClick={onSearch}>{t("workspace.interface.search_meldiq_7c5a6e1")}</button>
      </header>
      <div className="view scroll">
        <div className="discover discover-reference">
          <div className="discover-hero">
            <h2>{t("discover_heading")}</h2>
            <p className="view-sub">{v2 ? t("discover_sub_tags") : t("discover_sub")}</p>
            <label className="discover-search">
              <Search size={18} aria-hidden="true" />
              <input type="search" value={q} maxLength={60} onChange={(e) => setQ(e.target.value)} placeholder={t("discover_search")} aria-label={t("discover_search")} data-autofocus />
            </label>
            {tag && (
              <span className="discover-tag-active">
                {t("discover_tagged", { tag })}
                <button type="button" className="icon-btn" onClick={() => setTag(null)} aria-label={t("discover_clear_tag")} title={t("discover_clear_tag")}>
                  <X size={14} />
                </button>
              </span>
            )}
          </div>
          {v2 && (
            <div className="discover-filterbar">
              <div className="discover-filter-tags" role="group" aria-label={t("workspace.reference.discoverTags")}>
                {FEATURED_TAGS.map((item) => (
                  <button key={item} type="button" className="discover-filter-tag" aria-pressed={tag === item} onClick={() => setTag(tag === item ? null : item)}>
                    #{item}
                  </button>
                ))}
                <select
                  className="input discover-filter-more"
                  aria-label={t("workspace.reference.moreTags")}
                  value={tag && EXTRA_TAGS.includes(tag) ? tag : ""}
                  onChange={(event) => setTag(event.target.value || null)}
                >
                  <option value="">{t("workspace.reference.moreTags")}</option>
                  {EXTRA_TAGS.map((item) => (
                    <option key={item} value={item}>
                      #{item}
                    </option>
                  ))}
                </select>
              </div>
              {sortable && (
                <select className="input" aria-label={t("workspace.reference.discoverySort")} value={sort} onChange={(event) => setSort(event.target.value as DiscoverSort)}>
                  <option value="recommended">{t("workspace.reference.recommended")}</option>
                  <option value="members">{t("workspace.reference.mostMembers")}</option>
                  <option value="newest">{t("workspace.reference.newest")}</option>
                  <option value="name">{t("workspace.reference.alphabetical")}</option>
                </select>
              )}
              <select className="input" aria-label={t("workspace.reference.findSize")} value={size} onChange={(event) => setSize(event.target.value as DiscoverSize)}>
                <option value="any">{t("workspace.reference.anySize")}</option>
                <option value="small">{t("workspace.reference.smallSize")}</option>
                <option value="medium">{t("workspace.reference.mediumSize")}</option>
                <option value="large">{t("workspace.reference.largeSize")}</option>
              </select>
            </div>
          )}
          {error !== null && (
            <div className="banner danger" role="alert">
              <span className="grow">{error || t("discover_error")}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setAttempt((n) => n + 1)}>
                {t("discover_retry")}
              </button>
            </div>
          )}
          {!page && error === null && (
            <div className="discover-grid" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <span key={i} className="skeleton discover-card-skeleton" />
              ))}
            </div>
          )}
          {promoted.length > 0 && (
            <>
              <h3 className="discover-section discover-section-promoted">{t("discover_promoted")}</h3>
              <ul className="discover-grid discover-promoted" aria-label={t("discover_promoted")}>
                {promoted.map((c) => (
                  <li key={c.id}>{card(c)}</li>
                ))}
              </ul>
            </>
          )}
          {list && list.length === 0 && promoted.length === 0 && page?.nextCursor == null && (
            <div className="empty" style={{ padding: 24 }}>
              <div className="discover-empty-art" aria-hidden="true">
                <Compass size={160} strokeWidth={0.6} />
                <img src="/meldling-192.webp" width={80} height={80} alt="" draggable={false} />
              </div>
              <p className="muted">{filtered ? t("discover_none_match") : t("discover_none")}</p>
              {filtered && (
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setQ("");
                    setQuery("");
                    setTag(null);
                    setSize("any");
                  }}
                >
                  {t("discover_all")}
                </button>
              )}
            </div>
          )}
          {list && list.length > 0 && <h3 className="discover-section">{filtered ? t("discover_results") : t("discover_all")}</h3>}
          {list && list.length > 0 && (
            <ul className="discover-grid" aria-label={filtered ? t("discover_results") : t("discover_all")}>
              {list.map((c) => (
                <li key={c.id}>{card(c)}</li>
              ))}
            </ul>
          )}
          {page?.nextCursor != null && (
            <button className="btn btn-secondary discover-more" disabled={loadingMore} onClick={() => void more()}>
              {t("discover_more")}
            </button>
          )}
        </div>
      </div>
      {preview && <CommunityPreviewDialog id={preview} onClose={() => setPreview(null)} />}
    </section>
  );
}

const markJoined = (list: DiscoverCard[], id: string) => list.map((x) => (x.id === id ? { ...x, joined: true } : x));

const errorText = (e: unknown) => (e instanceof ApiError ? e.message : "");
