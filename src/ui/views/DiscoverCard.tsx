import { BadgeCheck, Users } from "lucide-react";
import { useState } from "react";
import { ApiError } from "../../api/client";
import type { CardLabel, DiscoverCard } from "../../api/discoverySchemas";
import { useEngine } from "../../application/orbit";
import { setPrefs } from "../../application/prefs";
import { navigate } from "../../application/router";
import { type StringKey, useT } from "../../i18n";
import { joinCommunity } from "../../sync/community";
import { cardLabelTone } from "../../sync/discovery/rules";
import { accentBand } from "../community/accent";
import { colorIndexOf } from "../components/Avatar";
import { OrgAvatar } from "../components/OrgAvatar";
import { usePhoto } from "../components/photos";
import { members } from "../format";

const LABEL_KEYS: Record<NonNullable<Exclude<CardLabel, "unknown">>, StringKey> = {
  promoted: "discover_label_promoted",
  mega: "discover_label_mega",
  super: "discover_label_super",
  boost: "discover_label_boost",
};

interface DiscoverCardProps {
  c: DiscoverCard;
  onPreview: () => void;
  onJoined: (id: string) => void;
  /** Filters Discover by a tag on the card (servers with discovery-listing). */
  onTag?: (tag: string) => void;
}

/**
 * One community on Discover (community-first brief §3B; community parity E): banner, icon, name, its label (PROMOTED,
 * MEGA BOOSTED in gold, SUPER BOOSTED, BOOSTED), the one-line description, tags, members and who's online, and one clear
 * action: Open when joined, Join when anyone may, otherwise View (to apply, or to read that it's invite-only).
 */
export function DiscoverCommunityCard({ c, onPreview, onJoined, onTag }: DiscoverCardProps) {
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
      setError(e instanceof ApiError ? e.message : t("discover_join_failed"));
    } finally {
      setBusy(false);
    }
  };
  // API 0.44.0: its own banner, or a band in its accent; otherwise one of Meldiq's.
  const bannerUrl = usePhoto("banner", c.id, c.bannerRev);
  const directJoin = !c.joined && c.joinPolicy === "open" && !c.applications;
  const labelKey = c.label && c.label !== "unknown" ? LABEL_KEYS[c.label] : null;
  return (
    <article className="discover-card" aria-labelledby={`dc-${c.id}`} data-label={c.label ?? undefined}>
      <button className="discover-card-body" onClick={onPreview} aria-describedby={`dc-${c.id}-how`}>
        <span className="discover-card-band" style={bannerUrl ? { backgroundImage: `url(${bannerUrl})` } : { background: c.accent ? accentBand(c.accent) : bandOf(c.id) }} aria-hidden="true" />
        {labelKey && <span className={`discover-label discover-label-${cardLabelTone(c.label)}`}>{t(labelKey)}</span>}
        <span className="discover-card-icon">
          <OrgAvatar orgId={c.id} name={c.name} photoRev={c.photoRev} size={64} />
        </span>
        <strong id={`dc-${c.id}`} className="ellipsis discover-name">
          {c.name}
          {c.official && <BadgeCheck size={16} className="discover-official" aria-label={t("discover_official")} />}
        </strong>
        {c.description && <span className="discover-desc">{c.description}</span>}
      </button>
      {c.tags.length > 0 && (
        <ul className="discover-tags" aria-label="Tags">
          {c.tags.map((tag) => (
            <li key={tag}>
              {onTag ? (
                <button type="button" className="discover-tag" onClick={() => onTag(tag)} aria-label={t("discover_tag_filter", { tag })}>
                  {tag}
                </button>
              ) : (
                <span className="discover-tag">{tag}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <footer className="discover-card-foot">
        <span className="faint discover-meta">
          <Users size={14} aria-hidden="true" /> {members(c.memberCount)}
          {c.onlineCount > 0 && (
            <>
              {" · "}
              <span className="discover-online">{t("discover_online", { n: c.onlineCount })}</span>
            </>
          )}
          {" · "}
          <span id={`dc-${c.id}-how`}>{how}</span>
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
