import { Check, Copy, Link2, Share2 } from "lucide-react";
import { useState } from "react";
import { ApiError } from "../../api/client";
import type { NewInvite } from "../../api/workspaceSchemas";
import { useEngine } from "../../application/orbit";
import { inviteLink } from "../../sync/inviteCodes";
import { createInvitation } from "../../sync/workspaces";
import { untilWhen } from "../format";

/** Batch B4 (android InviteChoices): 1 hour to 30 days, and 1 to 500 uses. */
export const EXPIRY: { hours: number; label: string }[] = [
  { hours: 1, label: "1 hour" },
  { hours: 24, label: "1 day" },
  { hours: 72, label: "3 days" },
  { hours: 24 * 7, label: "7 days" },
  { hours: 24 * 30, label: "30 days" },
];

export const USES = [1, 10, 50, 100, 500];

/** Copy link, copy code, and the system share sheet where there is one; the link to select by hand if copying fails. */
export function InviteShare({ code }: { code: string }) {
  const link = inviteLink(code);
  const [done, setDone] = useState<"link" | "code" | null>(null);
  const [manual, setManual] = useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const copy = (what: "link" | "code") => {
    const write = navigator.clipboard?.writeText(what === "link" ? link : code);
    if (!write) return setManual(true);
    void write.then(
      () => {
        setDone(what);
        setTimeout(() => setDone(null), 1500);
      },
      () => setManual(true),
    );
  };
  return (
    <div className="invite-share" role="group" aria-label="Share this invitation">
      <button className="btn btn-primary btn-sm" onClick={() => copy("link")} aria-live="polite">
        {done === "link" ? <Check size={14} /> : <Link2 size={14} />} {done === "link" ? "Link copied" : "Copy link"}
      </button>
      <button className="btn btn-secondary btn-sm" onClick={() => copy("code")} aria-live="polite">
        {done === "code" ? <Check size={14} /> : <Copy size={14} />} {done === "code" ? "Copied" : "Copy code"}
      </button>
      {canShare && (
        <button className="btn btn-secondary btn-sm" onClick={() => void navigator.share({ title: "Join me on Meldiq", url: link }).catch(() => undefined)}>
          <Share2 size={14} /> Share…
        </button>
      )}
      {manual && <input className="input mono" readOnly value={link} aria-label="Invitation link" onFocus={(e) => e.currentTarget.select()} />}
    </div>
  );
}

/**
 * An invitation link made on the spot (community-first brief §F, the reference's "send a server invite link"): a link
 * field with Create, then Copy, beside it. It's made only when asked, with the expiry and use limit stated next to it
 * (Change picks others), and it never lasts forever (the server's longest is 30 days).
 */
export function QuickInvite({ orgId }: { orgId: string }) {
  const engine = useEngine();
  const [hours, setHours] = useState(24 * 7);
  const [uses, setUses] = useState(10);
  const [editing, setEditing] = useState(false);
  const [made, setMade] = useState<NewInvite | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      setMade(await createInvitation(engine, orgId, { role: "MEMBER", branchId: null, teamId: null, maxUses: uses, expiresInHours: hours }));
      setEditing(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't create the link. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const copy = () => {
    if (!made) return;
    void navigator.clipboard?.writeText(inviteLink(made.code)).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => undefined,
    );
  };
  const expiry = EXPIRY.find((x) => x.hours === hours)?.label ?? `${hours} hours`;
  const admits = (n: number) => (n === 1 ? "one person" : `up to ${n} people`);

  return (
    <div className="quick-invite" aria-live="polite">
      {error && (
        <div className="banner danger" role="alert">
          {error}
        </div>
      )}
      <div className="invite-link-row">
        <input
          className={`input${made ? " mono" : ""}`}
          readOnly
          value={made ? inviteLink(made.code) : ""}
          placeholder="Create a link to share"
          aria-label="Invitation link"
          onFocus={(e) => e.currentTarget.select()}
        />
        {made ? (
          <button className="btn btn-primary" onClick={copy} aria-label="Copy link">
            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy"}
          </button>
        ) : (
          <button className="btn btn-primary" disabled={busy} onClick={() => void create()}>
            <Link2 size={16} /> {busy ? "Creating…" : "Create link"}
          </button>
        )}
      </div>
      {editing ? (
        <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "end" }}>
          <label className="field grow" style={{ minWidth: 120 }}>
            <span>Expires after</span>
            <select className="input" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
              {EXPIRY.map((x) => (
                <option key={x.hours} value={x.hours}>
                  {x.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field grow" style={{ minWidth: 120 }}>
            <span>Max uses</span>
            <select className="input" value={uses} onChange={(e) => setUses(Number(e.target.value))}>
              {USES.map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? "1 person" : `${n} people`}
                </option>
              ))}
            </select>
          </label>
          {made && (
            <button className="btn btn-secondary" disabled={busy} onClick={() => void create()}>
              Make a new link
            </button>
          )}
        </div>
      ) : (
        <small className="faint">
          {made ? `Admits ${admits(made.maxUses)} · expires ${untilWhen(made.expiresAt)}. Revoke it any time in Invitations.` : `Your link will expire after ${expiry} and admit ${admits(uses)}.`}{" "}
          <button className="link-btn" onClick={() => setEditing(true)}>
            Change
          </button>
        </small>
      )}
    </div>
  );
}
