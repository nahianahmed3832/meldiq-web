import { confirmAction } from "../components/ConfirmationDialog";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
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
const favoritesLabel = () => uiText("settings.interface.favourites_ba25355");
const OWN_FILTERS = (): [OwnFilter, string][] => [
  ["all", uiText("settings.ap_all")],
  ["pictures", uiText("settings.interface.pictures_1e62450")],
  ["classic", uiText("workspace.interface.classic_ae25d64")],
];
const OWN_FILTERS_WITH_FAVORITES = (): [OwnFilter, string][] => [["all", uiText("settings.ap_all")], ["favorites", favoritesLabel()], ...OWN_FILTERS().slice(1)];
const SHOWS = (): [Show, string][] => [
  ["all", uiText("settings.ap_all")],
  ["favorites", favoritesLabel()],
];
const MOTIONS = (): [Motion, string][] => [
  ["all", uiText("settings.ap_all")],
  ["moving", uiText("settings.interface.moving_8dac743")],
  ["still", uiText("settings.interface.still_70bcb5a")],
];
function Chips<T extends string>({ label, options, value, onChange }: { label: string; options: [T, string][]; value: T; onChange: (v: T) => void }) {
  useLocaleRender();
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
  get pending() {
    return uiText("settings.interface.waiting_for_review_a61935d");
  },
  get approved() {
    return uiText("workspace.interface.approved_87b42e4");
  },
  get rejected() {
    return uiText("settings.interface.turned_down_8110ac9");
  },
  get removed() {
    return uiText("settings.interface.taken_down_70e3713");
  },
};
/**
 * Settings › Profile style › Decoration (API 0.60.0, server docs/PROFILE_DECORATIONS.md): Meldiq's own (the classic
 * frames and the newer images), community ones with their maker's name, and your own submissions with how their review
 * went. Each tile shows the decoration on your own avatar. Since API 0.65.0 a star on each tile keeps it in your
 * favourites, which both tabs can show on their own.
 */
export function DecorationPicker({ me, photoRev, current, onPick }: DecorationPickerProps) {
  useLocaleRender();
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
        {by && (
          <small className="faint ellipsis">
            <Localized k="settings.interface.by_281c239" slots={[by]} />
          </small>
        )}
      </button>
      {id && fav && (
        <button
          type="button"
          className="deco-star"
          aria-pressed={fav.has(id)}
          aria-label={
            fav.has(id) ? uiText("settings.interface.remove_value0_from_favourites_6c361fc", { value0: label }) : uiText("settings.interface.add_value0_to_favourites_5cbe80a", { value0: label })
          }
          title={fav.has(id) ? uiText("settings.interface.remove_from_favourites_a5bdece") : uiText("settings.interface.add_to_favourites_9e619bf")}
          onClick={() => favorites.toggle(id)}
        >
          <Star size={14} fill={fav.has(id) ? "currentColor" : "none"} aria-hidden="true" />
        </button>
      )}
    </div>
  );
  const withdraw = async (s: DecorationSubmission) => {
    const what =
      s.status === "approved"
        ? uiText("settings.interface.take_value0_out_of_the_catalog_everyone_wearing_it_goes_back_to_n_7ff9363", { value0: s.name })
        : uiText("settings.interface.withdraw_value0_7a1e4d1", { value0: s.name });
    if (!(await confirmAction(what))) return;
    setError(null);
    try {
      await withdrawDecoration(engine, s.id);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : uiText("workspace.interface.that_didn_t_work_try_again_5da2573"));
    }
  };
  return (
    <div className="deco-picker">
      <div className="deco-tabs" role="tablist" aria-label={uiText("settings.interface.decorations_5a02b05")}>
        {(
          [
            ["meldiq", "Meldiq"],
            ["community", uiText("organization.community")],
            ["yours", uiText("settings.interface.yours_54b26f7")],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={`deco-tab${tab === key ? " active" : ""}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
        <button type="button" className="btn btn-secondary btn-sm deco-make" onClick={() => setMaking(true)}>
          <Localized k="settings.interface.make_your_own_7f3f0f8" slots={[<Brush size={14} />]} />
        </button>
      </div>

      {catalog.error && (
        <div className="banner danger" role="alert">
          <Localized k="settings.interface.decorations_couldn_t_be_loaded_8c2a96f" slots={[catalog.error]} />
        </div>
      )}
      {(error ?? favorites.error) && (
        <div className="banner danger" role="alert">
          {error ?? favorites.error}
        </div>
      )}

      {tab === "meldiq" && (
        <>
          <Chips label={uiText("messaging.interface.show_0df6f1c")} options={fav ? OWN_FILTERS_WITH_FAVORITES() : OWN_FILTERS()} value={ownFilter} onChange={setOwnFilter} />
          <div className="style-grid deco-grid" role="group" aria-label={uiText("settings.interface.meldiq_s_decorations_cf68a04")}>
            {!onlyFavorites && tile(null, uiText("settings.ap_none"))}
            {ownFilter !== "pictures" && PROFILE_DECORATIONS.filter(starred).map((d) => tile(d, DECORATION_LABEL[d]))}
            {ownFilter !== "classic" && own.filter((d) => starred(d.id)).map((d) => tile(d.id, d.name))}
            {ownFilter !== "classic" && !catalog.data && !catalog.error && <div className="skeleton deco-skeleton" aria-busy="true" />}
          </div>
          {onlyFavorites && fav && ![...PROFILE_DECORATIONS, ...own.map((d) => d.id)].some((id) => fav.has(id)) && (
            <p className="faint">
              <Localized k="settings.interface.no_favourites_here_yet_tap_the_star_on_a_decoration_to_keep_it_he_8c3dede" />
            </p>
          )}
        </>
      )}

      {tab === "community" && (
        <>
          <div className="row deco-community-bar">
            <label className="deco-search grow">
              <Search size={14} aria-hidden="true" />
              <input
                type="search"
                placeholder={uiText("settings.interface.search_by_name_or_maker_8a0f9e0")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label={uiText("settings.interface.search_community_decorations_030c654")}
              />
            </label>
            <Chips label={uiText("settings.interface.motion_8ca3442")} options={MOTIONS()} value={motion} onChange={setMotion} />
            {fav && <Chips label={uiText("messaging.interface.show_0df6f1c")} options={SHOWS()} value={communityShow} onChange={setCommunityShow} />}
          </div>
          <div className="style-grid deco-grid" role="group" aria-label={uiText("settings.interface.community_decorations_9fe0b24")}>
            {community.map((d: Decoration) => tile(d.id, d.name, d.creator?.username ?? null))}
          </div>
          {catalog.data && community.length === 0 && (
            <p className="faint">
              {communityShow === "favorites" && !query && motion === "all"
                ? uiText("settings.interface.no_favourites_here_yet_tap_the_star_on_a_decoration_to_keep_it_he_8c3dede")
                : query || motion !== "all" || communityShow !== "all"
                  ? uiText("settings.interface.no_decoration_matches_that_38e7603")
                  : uiText("settings.interface.no_community_decorations_yet_make_the_first_one_585883b")}
            </p>
          )}
        </>
      )}

      {tab === "yours" && (
        <div className="deco-mine">
          {mine.data && (
            <p className="faint" style={{ margin: 0 }}>
              <Localized
                k="settings.interface.of_waiting_for_review_deff446"
                slots={[mine.data.artist ? uiText("settings.interface.you_re_a_meldiq_artist_fc0e42e") : "", mine.data.pending, mine.data.pendingLimit]}
              />
            </p>
          )}
          {mine.data?.submissions.length === 0 && (
            <p className="faint">
              <Localized k="settings.interface.nothing_sent_in_yet_make_one_and_it_shows_up_here_while_it_s_revi_163fc28" />
            </p>
          )}
          <ul className="deco-submissions">
            {mine.data?.submissions.map((s) => (
              <li key={s.id} className="deco-submission">
                <SubmissionPreview submission={s} me={me} photoRev={photoRev} />
                <div className="deco-submission-text">
                  <strong className="ellipsis">{s.name}</strong>
                  <span className={`deco-status ${s.status}`}>{STATUS_WORDS[s.status]}</span>
                  {s.reason && <small className="faint">{s.reason}</small>}
                  {s.status === "approved" && (
                    <small className="faint">
                      {s.wearers === 1 ? uiText("settings.interface.1_person_wears_it_d0374c4") : uiText("settings.interface.value0_people_wear_it_5c10e81", { value0: s.wearers })}
                    </small>
                  )}
                </div>
                <div className="row" style={{ gap: 6 }}>
                  {s.status === "approved" && (
                    <button type="button" className="btn btn-secondary btn-sm" disabled={current === s.id} onClick={() => onPick(s.id)}>
                      {current === s.id ? uiText("workspace.interface.wearing_5ccbf93") : uiText("workspace.interface.wear_39bb722")}
                    </button>
                  )}
                  {(s.status === "pending" || s.status === "approved") && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => void withdraw(s)} aria-label={uiText("settings.interface.withdraw_value0_2d3523d", { value0: s.name })}>
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
  useLocaleRender();
  const approved = submission.status === "approved";
  const url = usePhoto("ownDecoration", submission.id, approved ? null : 1, "image/png");
  return (
    <span className="deco-submission-preview">
      <StyledAvatar userId={me.userId} name={me.displayName} colorIndex={me.avatarColor} photoRev={photoRev} media={null} decoration={approved ? submission.id : null} size={44} />
      {!approved && url && <img className="deco-img" src={url} width={53} height={53} style={{ left: -4, top: -4 }} alt="" aria-hidden="true" />}
    </span>
  );
}
