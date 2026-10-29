import { Brush, Search, Star, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ApiError } from "../../api/client";
import { PROFILE_DECORATIONS } from "../../api/schemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { type Decoration, type DecorationSubmission, decorationCatalog, myDecorations, withdrawDecoration } from "../../sync/decorations";
import { usePhoto } from "../components/photos";
import { DECORATION_LABEL, StyledAvatar } from "../people/ProfileStyle";
import { useLoad } from "../workspace/useLoad";
import { SubmitDecorationDialog } from "./SubmitDecorationDialog";
import { useDecorationFavorites } from "./useDecorationFavorites";

interface Me {
  userId: string;
  displayName: string;
  avatarColor: number;
}

interface DecorationPickerProps {
  me: Me;
  photoRev: number | null;
  current: string | null;
  onPick: (id: string | null) => void;
}

type Tab = "meldiq" | "community" | "yours";
/** Meldiq's own: the pictures (images) or the classic frames (drawn by the apps); or only the ones you starred. */
type OwnFilter = "all" | "favorites" | "pictures" | "classic";
type Motion = "all" | "moving" | "still";
type Show = "all" | "favorites";

const FAVORITES_LABEL = "★ Favourites";
const OWN_FILTERS: [OwnFilter, string][] = [
  ["all", "All"],
  ["pictures", "Pictures"],
  ["classic", "Classic"],
];
const OWN_FILTERS_WITH_FAVORITES: [OwnFilter, string][] = [["all", "All"], ["favorites", FAVORITES_LABEL], ...OWN_FILTERS.slice(1)];
const SHOWS: [Show, string][] = [
  ["all", "All"],
  ["favorites", FAVORITES_LABEL],
];
const MOTIONS: [Motion, string][] = [
  ["all", "All"],
  ["moving", "Moving"],
  ["still", "Still"],
];

function Chips<T extends string>({ label, options, value, onChange }: { label: string; options: [T, string][]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="segmented deco-chips" role="group" aria-label={label}>
      {options.map(([key, text]) => (
        <button key={key} type="button" aria-pressed={value === key} onClick={() => onChange(key)}>
          {text}
        </button>
      ))}
    </div>
  );
}

const STATUS_WORDS: Record<DecorationSubmission["status"], string> = {
  pending: "Waiting for review",
  approved: "Approved",
  rejected: "Turned down",
  removed: "Taken down",
};

/**
 * Settings › Profile style › Decoration (API 0.60.0, server docs/PROFILE_DECORATIONS.md): Meldiq's own (the classic
 * frames and the newer images), community ones with their maker's name, and your own submissions with how their review
 * went. Each tile shows the decoration on your own avatar. Since API 0.65.0 a star on each tile keeps it in your
 * favourites, which both tabs can show on their own.
 */
export function DecorationPicker({ me, photoRev, current, onPick }: DecorationPickerProps) {
  const engine = useEngine();
  const [tab, setTab] = useState<Tab>("meldiq");
  const [query, setQuery] = useState("");
  const [ownFilter, setOwnFilter] = useState<OwnFilter>("all");
  const [motion, setMotion] = useState<Motion>("all");
  const [communityShow, setCommunityShow] = useState<Show>("all");
  const favoritesOn = useOrbit((s) => s.server?.features.includes("decoration-favorites") ?? false);
  const favorites = useDecorationFavorites(engine, favoritesOn);
  const fav = favorites.ids;
  const [version, setVersion] = useState(0);
  const [making, setMaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const catalog = useLoad(() => decorationCatalog(engine), [engine, version]);
  const mine = useLoad(() => myDecorations(engine), [engine, version]);

  const all = useMemo(() => catalog.data?.decorations ?? [], [catalog.data]);
  const onlyFavorites = (ownFilter === "favorites" && tab === "meldiq") || (communityShow === "favorites" && tab === "community");
  const starred = (id: string) => !onlyFavorites || !!fav?.has(id);
  const own = useMemo(() => all.filter((d) => d.kind === "meldiq"), [all]);
  const community = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter(
      (d) =>
        d.kind === "community" &&
        (communityShow === "all" || !!fav?.has(d.id)) &&
        (motion === "all" || d.animated === (motion === "moving")) &&
        (!q || d.name.toLowerCase().includes(q) || (d.creator?.username ?? "").toLowerCase().includes(q)),
    );
  }, [all, query, motion, communityShow, fav]);

  const tile = (id: string | null, label: string, by?: string | null) => (
    <div key={id ?? "none"} className="deco-tile">
      <button type="button" className="style-choice deco-choice" aria-pressed={current === id} onClick={() => onPick(id)} title={label}>
        <StyledAvatar userId={me.userId} name={me.displayName} colorIndex={me.avatarColor} photoRev={photoRev} media={null} decoration={id} size={48} />
        <span className="ellipsis">{label}</span>
        {by && <small className="faint ellipsis">by @{by}</small>}
      </button>
      {id && fav && (
        <button
          type="button"
          className="deco-star"
          aria-pressed={fav.has(id)}
          aria-label={fav.has(id) ? `Remove ${label} from favourites` : `Add ${label} to favourites`}
          title={fav.has(id) ? "Remove from favourites" : "Add to favourites"}
          onClick={() => favorites.toggle(id)}
        >
          <Star size={14} fill={fav.has(id) ? "currentColor" : "none"} aria-hidden="true" />
        </button>
      )}
    </div>
  );

  const withdraw = async (s: DecorationSubmission) => {
    const what = s.status === "approved" ? `Take "${s.name}" out of the catalog? Everyone wearing it goes back to no decoration.` : `Withdraw "${s.name}"?`;
    if (!window.confirm(what)) return;
    setError(null);
    try {
      await withdrawDecoration(engine, s.id);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work. Try again.");
    }
  };

  return (
    <div className="deco-picker">
      <div className="deco-tabs" role="tablist" aria-label="Decorations">
        {(
          [
            ["meldiq", "Meldiq"],
            ["community", "Community"],
            ["yours", "Yours"],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={`deco-tab${tab === key ? " active" : ""}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
        <button type="button" className="btn btn-secondary btn-sm deco-make" onClick={() => setMaking(true)}>
          <Brush size={14} /> Make your own
        </button>
      </div>

      {catalog.error && (
        <div className="banner danger" role="alert">
          Decorations couldn't be loaded. {catalog.error}
        </div>
      )}
      {(error ?? favorites.error) && (
        <div className="banner danger" role="alert">
          {error ?? favorites.error}
        </div>
      )}

      {tab === "meldiq" && (
        <>
          <Chips label="Show" options={fav ? OWN_FILTERS_WITH_FAVORITES : OWN_FILTERS} value={ownFilter} onChange={setOwnFilter} />
          <div className="style-grid deco-grid" role="group" aria-label="Meldiq's decorations">
            {!onlyFavorites && tile(null, "None")}
            {ownFilter !== "pictures" && PROFILE_DECORATIONS.filter(starred).map((d) => tile(d, DECORATION_LABEL[d]))}
            {ownFilter !== "classic" && own.filter((d) => starred(d.id)).map((d) => tile(d.id, d.name))}
            {ownFilter !== "classic" && !catalog.data && !catalog.error && <div className="skeleton deco-skeleton" aria-busy="true" />}
          </div>
          {onlyFavorites && fav && ![...PROFILE_DECORATIONS, ...own.map((d) => d.id)].some((id) => fav.has(id)) && (
            <p className="faint">No favourites here yet. Tap the star on a decoration to keep it here.</p>
          )}
        </>
      )}

      {tab === "community" && (
        <>
          <div className="row deco-community-bar">
            <label className="deco-search grow">
              <Search size={14} aria-hidden="true" />
              <input type="search" placeholder="Search by name or maker" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search community decorations" />
            </label>
            <Chips label="Motion" options={MOTIONS} value={motion} onChange={setMotion} />
            {fav && <Chips label="Show" options={SHOWS} value={communityShow} onChange={setCommunityShow} />}
          </div>
          <div className="style-grid deco-grid" role="group" aria-label="Community decorations">
            {community.map((d: Decoration) => tile(d.id, d.name, d.creator?.username ?? null))}
          </div>
          {catalog.data && community.length === 0 && (
            <p className="faint">
              {communityShow === "favorites" && !query && motion === "all"
                ? "No favourites here yet. Tap the star on a decoration to keep it here."
                : query || motion !== "all" || communityShow !== "all"
                  ? "No decoration matches that."
                  : "No community decorations yet. Make the first one!"}
            </p>
          )}
        </>
      )}

      {tab === "yours" && (
        <div className="deco-mine">
          {mine.data && (
            <p className="faint" style={{ margin: 0 }}>
              {mine.data.artist ? "You're a Meldiq artist. " : ""}
              {mine.data.pending} of {mine.data.pendingLimit} waiting for review.
            </p>
          )}
          {mine.data?.submissions.length === 0 && <p className="faint">Nothing sent in yet. Make one and it shows up here while it's reviewed.</p>}
          <ul className="deco-submissions">
            {mine.data?.submissions.map((s) => (
              <li key={s.id} className="deco-submission">
                <SubmissionPreview submission={s} me={me} photoRev={photoRev} />
                <div className="deco-submission-text">
                  <strong className="ellipsis">{s.name}</strong>
                  <span className={`deco-status ${s.status}`}>{STATUS_WORDS[s.status]}</span>
                  {s.reason && <small className="faint">{s.reason}</small>}
                  {s.status === "approved" && <small className="faint">{s.wearers === 1 ? "1 person wears it" : `${s.wearers} people wear it`}</small>}
                </div>
                <div className="row" style={{ gap: 6 }}>
                  {s.status === "approved" && (
                    <button type="button" className="btn btn-secondary btn-sm" disabled={current === s.id} onClick={() => onPick(s.id)}>
                      {current === s.id ? "Wearing" : "Wear"}
                    </button>
                  )}
                  {(s.status === "pending" || s.status === "approved") && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => void withdraw(s)} aria-label={`Withdraw ${s.name}`}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {making && (
        <SubmitDecorationDialog
          me={me}
          photoRev={photoRev}
          templateUrl={catalog.data?.templateUrl ?? null}
          onClose={() => setMaking(false)}
          onSent={() => {
            setMaking(false);
            setTab("yours");
            setVersion((v) => v + 1);
          }}
        />
      )}
    </div>
  );
}

/** Your own submission over your avatar; a waiting one's image needs your sign-in, so it's fetched like a photo. */
function SubmissionPreview({ submission, me, photoRev }: { submission: DecorationSubmission; me: Me; photoRev: number | null }) {
  const approved = submission.status === "approved";
  const url = usePhoto("ownDecoration", submission.id, approved ? null : 1, "image/png");
  return (
    <span className="deco-submission-preview">
      <StyledAvatar userId={me.userId} name={me.displayName} colorIndex={me.avatarColor} photoRev={photoRev} media={null} decoration={approved ? submission.id : null} size={44} />
      {!approved && url && <img className="deco-img" src={url} width={53} height={53} style={{ left: -4, top: -4 }} alt="" aria-hidden="true" />}
    </span>
  );
}
