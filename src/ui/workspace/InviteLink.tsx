import { countLabel } from "../../i18n/counts";
import { formatUnit } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Check, Copy, Link2, Share2 } from "lucide-react";
import { useState } from "react";
import { ApiError } from "../../api/client";
import type { NewInvite } from "../../api/workspaceSchemas";
import { useEngine } from "../../application/orbit";
import { inviteLink } from "../../sync/inviteCodes";
import { createInvitation } from "../../sync/workspaces";
import { untilWhen } from "../format";
/** Batch B4 (android InviteChoices): 1 hour to 30 days, and 1 to 500 uses. */
export const EXPIRY: {
  hours: number;
  label: string;
}[] = [
  {
    hours: 1,
    get label() {
      return formatUnit(1, "hour");
    },
  },
  {
    hours: 24,
    get label() {
      return formatUnit(1, "day");
    },
  },
  {
    hours: 72,
    get label() {
      return formatUnit(3, "day");
    },
  },
  {
    hours: 24 * 7,
    get label() {
      return formatUnit(7, "day");
    },
  },
  {
    hours: 24 * 30,
    get label() {
      return formatUnit(30, "day");
    },
  },
];
export const USES = [1, 10, 50, 100, 500];
/** Copy link, copy code, and the system share sheet where there is one; the link to select by hand if copying fails. */
export function InviteShare({ code }: { code: string }) {
  useLocaleRender();
  const l10n = useLocalization();
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
    <div className="invite-share" role="group" aria-label={uiText("workspace.interface.share_this_invitation_005391e")}>
      <button className="btn btn-primary btn-sm" onClick={() => copy("link")} aria-live="polite">
        {done === "link" ? <Check size={14} /> : <Link2 size={14} />} {done === "link" ? uiText("workspace.interface.link_copied_d12860c") : l10n("messaging.fwd_copy_link")}
      </button>
      <button className="btn btn-secondary btn-sm" onClick={() => copy("code")} aria-live="polite">
        {done === "code" ? <Check size={14} /> : <Copy size={14} />} {done === "code" ? l10n("common.common_copied") : uiText("workspace.interface.copy_code_49a0053")}
      </button>
      {canShare && (
        <button
          className="btn btn-secondary btn-sm"
          onClick={() =>
            void navigator
              .share({
                get title() {
                  return uiText("workspace.interface.join_me_on_meldiq_4414540");
                },
                url: link,
              })
              .catch(() => undefined)
          }
        >
          <Localized k="workspace.interface.share_552350b" slots={[<Share2 size={14} />]} />
        </button>
      )}
      {manual && <input className="input mono" readOnly value={link} aria-label={uiText("workspace.interface.invitation_link_88c3be3")} onFocus={(e) => e.currentTarget.select()} />}
    </div>
  );
}
/**
 * An invitation link made on the spot (community-first brief §F, the reference's "send a server invite link"): a link
 * field with Create, then Copy, beside it. It's made only when asked, with the expiry and use limit stated next to it
 * (Change picks others), and it never lasts forever (the server's longest is 30 days).
 */
export function QuickInvite({ orgId }: { orgId: string }) {
  useLocaleRender();
  const l10n = useLocalization();
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
      setError(e instanceof ApiError ? e.message : uiText("workspace.interface.couldn_t_create_the_link_try_again_1489f6b"));
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
  const expiry = EXPIRY.find((x) => x.hours === hours)?.label ?? formatUnit(hours, "hour");
  const admits = (n: number) => (n === 1 ? uiText("workspace.interface.one_person_2ab339c") : uiText("workspace.interface.up_to_value0_people_73e0eb7", { value0: n }));
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
          placeholder={uiText("workspace.interface.create_a_link_to_share_19e04b2")}
          aria-label={uiText("workspace.interface.invitation_link_88c3be3")}
          onFocus={(e) => e.currentTarget.select()}
        />
        {made ? (
          <button className="btn btn-primary" onClick={copy} aria-label={l10n("messaging.fwd_copy_link")}>
            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? l10n("common.common_copied") : l10n("common.actions.copy")}
          </button>
        ) : (
          <button className="btn btn-primary" disabled={busy} onClick={() => void create()}>
            <Link2 size={16} /> {busy ? l10n("auth.signup_busy") : uiText("workspace.interface.create_link_e6b850c")}
          </button>
        )}
      </div>
      {editing ? (
        <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "end" }}>
          <label className="field grow" style={{ minWidth: 120 }}>
            <span>
              <Localized k="workspace.interface.expires_after_a5e4b9f" />
            </span>
            <select className="input" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
              {EXPIRY.map((x) => (
                <option key={x.hours} value={x.hours}>
                  {x.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field grow" style={{ minWidth: 120 }}>
            <span>
              <Localized k="workspace.interface.max_uses_4d761fb" />
            </span>
            <select className="input" value={uses} onChange={(e) => setUses(Number(e.target.value))}>
              {USES.map((n) => (
                <option key={n} value={n}>
                  {countLabel(n, "people")}
                </option>
              ))}
            </select>
          </label>
          {made && (
            <button className="btn btn-secondary" disabled={busy} onClick={() => void create()}>
              <Localized k="workspace.interface.make_a_new_link_311a457" />
            </button>
          )}
        </div>
      ) : (
        <small className="faint">
          {made
            ? uiText("workspace.interface.admits_value0_expires_value1_revoke_it_any_time_in_invitations_c96be14", { value0: admits(made.maxUses), value1: untilWhen(made.expiresAt) })
            : uiText("workspace.interface.your_link_will_expire_after_value0_and_admit_value1_159d33a", { value0: expiry, value1: admits(uses) })}{" "}
          <button className="link-btn" onClick={() => setEditing(true)}>
            <Localized k="workspace.interface.change_c0bf75b" />
          </button>
        </small>
      )}
    </div>
  );
}
