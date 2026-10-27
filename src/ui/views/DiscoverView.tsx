import { Compass, Search, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "../../api/client";
import type { Discovered } from "../../api/communitySchemas";
import { useEngine } from "../../application/orbit";
import { setPrefs } from "../../application/prefs";
import { navigate } from "../../application/router";
import { useT } from "../../i18n";
import { discover, joinCommunity } from "../../sync/community";
import { CommunityPreviewDialog } from "../community/CommunityPreviewDialog";
import { colorIndexOf } from "../components/Avatar";
import { OrgAvatar } from "../components/OrgAvatar";
import { usePhoto } from "../components/photos";
import { accentBand } from "../community/accent";
import { members } from "../format";

/** How long typing pauses before the search runs. */
const SEARCH_DELAY_MS = 300;

/**
 * Discover (community-first brief §3B, the reference's Discover page): public communities from the server, most members
 * first, searched by name or description as you type. Each card shows only what the server says: icon, name,
 * description, member count and how to get in. Nothing is promoted or invented; there's no promotion system to show.
 */
export function DiscoverView() {
  const engine = useEngine();
  const t = useT();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [list, setList] = useState<Discovered[] | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setQuery(q.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    let live = true;
    setList(null);
    setError(null);
    discover(engine, query)
      .then((p) => {
        if (!live) return;
        setList(p.communities);
        setNext(p.nextCursor);
      })
      // The server's own message, or "" for the generic one (worded at render: t isn't a stable dependency).
      .catch((e: unknown) => live && setError(errorText(e, "")));
    return () => {
      live = false;
    };
  }, [engine, query, attempt]);

  const more = async () => {
    if (next === null) return;
    try {
      const p = await discover(engine, query, next);
      setList((l) => [...(l ?? []), ...p.communities]);
      setNext(p.nextCursor);
    } catch (e) {
      setError(errorText(e, ""));
    }
  };

  return (
    <section className="main" aria-label={t("discover_title")}>
      <header className="conv-head discover-head">
        <Compass size={18} aria-hidden="true" />
        <h1 className="grow">{t("discover_title")}</h1>
      </header>
      <div className="view scroll">
        <div className="discover">
          <div className="discover-hero">
            <h2>{t("discover_heading")}</h2>
            <p className="view-sub">{t("discover_sub")}</p>
            <label className="discover-search">
              <Search size={18} aria-hidden="true" />
              <input type="search" value={q} maxLength={60} onChange={(e) => setQ(e.target.value)} placeholder={t("discover_search")} aria-label={t("discover_search")} data-autofocus />
            </label>
          </div>
          {error !== null && (
            <div className="banner danger" role="alert">
              <span className="grow">{error || t("discover_error")}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setAttempt((n) => n + 1)}>
                {t("discover_retry")}
              </button>
            </div>
          )}
          {!list && error === null && (
            <div className="discover-grid" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <span key={i} className="skeleton discover-card-skeleton" />
              ))}
            </div>
          )}
          {list && list.length === 0 && (
            <div className="empty" style={{ padding: 24 }}>
              <span className="empty-orb">
                <Compass size={22} />
              </span>
              <p className="muted">{query ? t("discover_none_match") : t("discover_none")}</p>
            </div>
          )}
          {list && list.length > 0 && <h3 className="discover-section">{query ? t("discover_results") : t("discover_all")}</h3>}
          {list && list.length > 0 && (
            <ul className="discover-grid" aria-label={t("discover_results")}>
              {list.map((c) => (
                <li key={c.id}>
                  <CommunityCard c={c} onPreview={() => setPreview(c.id)} onJoined={(id) => setList((l) => l?.map((x) => (x.id === id ? { ...x, joined: true } : x)) ?? l)} />
                </li>
              ))}
            </ul>
          )}
          {next !== null && (
            <button className="btn btn-secondary discover-more" onClick={() => void more()}>
              {t("discover_more")}
            </button>
          )}
        </div>
      </div>
      {preview && <CommunityPreviewDialog id={preview} onClose={() => setPreview(null)} />}
    </section>
  );
}

function CommunityCard({ c, onPreview, onJoined }: { c: Discovered; onPreview: () => void; onJoined: (id: string) => void }) {
  const engine = useEngine();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const how = c.joined ? t("discover_joined") : c.applications ? t("discover_apply") : c.joinPolicy === "open" ? t("discover_open") : t("discover_invite_only");
  const open = () => {
    setPrefs({ orgId: c.id });
    navigate({ section: "home" });
  };
  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      await joinCommunity(engine, c.id);
      onJoined(c.id);
      open();
    } catch (e) {
      setError(errorText(e, t("discover_join_failed")));
    } finally {
      setBusy(false);
    }
  };
  // API 0.44.0: its own banner, or a band in its accent; otherwise one of Meldiq's.
  const bannerUrl = usePhoto("banner", c.id, c.bannerRev);
  // One clear action: Open when joined, Join when anyone may, otherwise View (to apply, or to read that it's invite-only).
  const directJoin = !c.joined && c.joinPolicy === "open" && !c.applications;
  return (
    <article className="discover-card" aria-labelledby={`dc-${c.id}`}>
      <button className="discover-card-body" onClick={onPreview} aria-describedby={`dc-${c.id}-how`}>
        <span className="discover-card-band" style={bannerUrl ? { backgroundImage: `url(${bannerUrl})` } : { background: c.accent ? accentBand(c.accent) : bandOf(c.id) }} aria-hidden="true" />
        <span className="discover-card-icon">
          <OrgAvatar orgId={c.id} name={c.name} photoRev={c.photoRev} size={64} />
        </span>
        <strong id={`dc-${c.id}`} className="ellipsis">
          {c.name}
        </strong>
        {c.description && <span className="discover-desc">{c.description}</span>}
      </button>
      <footer className="discover-card-foot">
        <span className="faint discover-meta">
          <Users size={14} aria-hidden="true" /> {members(c.memberCount)} · <span id={`dc-${c.id}-how`}>{how}</span>
        </span>
        {c.joined ? (
          <button className="btn btn-secondary btn-sm" onClick={open}>
            {t("discover_open_btn")}
          </button>
        ) : directJoin ? (
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void join()}>
            {busy ? t("discover_joining") : t("discover_join")}
          </button>
        ) : (
          <button className="btn btn-secondary btn-sm" onClick={onPreview}>
            {t("discover_view")}
          </button>
        )}
      </footer>
      {error && (
        <p className="discover-error" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}

/** Vivid bands in Meldiq's palette (cyan, blue, violet, pink, orange), one per community without a banner or accent. */
const BANDS = [
  "linear-gradient(120deg, #22d3ee, #6366f1)",
  "linear-gradient(120deg, #8b5cf6, #ec4899)",
  "linear-gradient(120deg, #f97316, #ec4899)",
  "linear-gradient(120deg, #0ea5e9, #22c55e)",
  "linear-gradient(120deg, #6366f1, #a855f7)",
  "linear-gradient(120deg, #14b8a6, #3b82f6)",
];
const bandOf = (id: string) => BANDS[colorIndexOf(id) % BANDS.length];

const errorText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);
