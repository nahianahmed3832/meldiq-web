import { Brush, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ApiError } from "../../api/client";
import { PROFILE_DECORATIONS } from "../../api/schemas";
import { useEngine } from "../../application/orbit";
import { type Decoration, type DecorationSubmission, decorationCatalog, myDecorations, withdrawDecoration } from "../../sync/decorations";
import { usePhoto } from "../components/photos";
import { DECORATION_LABEL, StyledAvatar } from "../people/ProfileStyle";
import { useLoad } from "../workspace/useLoad";
import { SubmitDecorationDialog } from "./SubmitDecorationDialog";

interface Me {
  userId: string;
  displayName: string;
  avatarColor: number;
}

interface DecorationPickerProps {
  me: Me;
  photoRev: number | null;
  current: string | null;
  busy: boolean;
  onPick: (id: string | null) => void;
}

type Tab = "meldiq" | "community" | "yours";

const STATUS_WORDS: Record<DecorationSubmission["status"], string> = {
  pending: "Waiting for review",
  approved: "Approved",
  rejected: "Turned down",
  removed: "Taken down",
};

/**
 * Settings › Profile style › Decoration (API 0.60.0, server docs/PROFILE_DECORATIONS.md): Meldiq's own (the classic
 * frames and the newer images), community ones with their maker's name, and your own submissions with how their review
 * went. Each tile shows the decoration on your own avatar; picking one saves it at once.
 */
export function DecorationPicker({ me, photoRev, current, busy, onPick }: DecorationPickerProps) {
  const engine = useEngine();
  const [tab, setTab] = useState<Tab>("meldiq");
  const [query, setQuery] = useState("");
  const [version, setVersion] = useState(0);
  const [making, setMaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const catalog = useLoad(() => decorationCatalog(engine), [engine, version]);
  const mine = useLoad(() => myDecorations(engine), [engine, version]);

  const all = useMemo(() => catalog.data?.decorations ?? [], [catalog.data]);
  const own = useMemo(() => all.filter((d) => d.kind === "meldiq"), [all]);
  const community = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((d) => d.kind === "community" && (!q || d.name.toLowerCase().includes(q) || (d.creator?.username ?? "").toLowerCase().includes(q)));
  }, [all, query]);

  const tile = (id: string | null, label: string, by?: string | null) => (
    <button key={id ?? "none"} type="button" className="style-choice deco-choice" aria-pressed={current === id} disabled={busy} onClick={() => onPick(id)} title={label}>
      <StyledAvatar userId={me.userId} name={me.displayName} colorIndex={me.avatarColor} photoRev={photoRev} media={null} decoration={id} size={48} />
      <span className="ellipsis">{label}</span>
      {by && <small className="faint ellipsis">by @{by}</small>}
    </button>
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
      {error && (
        <div className="banner danger" role="alert">
          {error}
        </div>
      )}

      {tab === "meldiq" && (
        <div className="style-grid deco-grid" role="group" aria-label="Meldiq's decorations">
          {tile(null, "None")}
          {PROFILE_DECORATIONS.map((d) => tile(d, DECORATION_LABEL[d]))}
          {own.map((d) => tile(d.id, d.name))}
          {!catalog.data && !catalog.error && <div className="skeleton deco-skeleton" aria-busy="true" />}
        </div>
      )}

      {tab === "community" && (
        <>
          <label className="deco-search">
            <Search size={14} aria-hidden="true" />
            <input type="search" placeholder="Search by name or maker" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search community decorations" />
          </label>
          <div className="style-grid deco-grid" role="group" aria-label="Community decorations">
            {community.map((d: Decoration) => tile(d.id, d.name, d.creator?.username ?? null))}
          </div>
          {catalog.data && community.length === 0 && <p className="faint">{query ? "No decoration matches that." : "No community decorations yet. Make the first one!"}</p>}
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
                    <button type="button" className="btn btn-secondary btn-sm" disabled={busy || current === s.id} onClick={() => onPick(s.id)}>
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
