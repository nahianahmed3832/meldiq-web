import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Eye, EyeOff, Pencil } from "lucide-react";
import { type FormEvent, useState } from "react";
import { ApiError } from "../../api/client";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate } from "../../application/router";
import { AccountSafetyApi, maskEmail } from "../../sync/accountSafety";
import { myProfile } from "../../sync/profile";
import { usePhoto } from "../components/photos";
import { Dialog } from "../components/Overlay";
import { LookAvatar, StyledName, useUserLook } from "../people/NameStyle";
import { useLoad } from "../workspace/useLoad";
type Editing = "email" | null;
/**
 * Settings › My Account, top (the reference's account card, 2026-10-28): your banner, avatar, name and username with
 * Edit profile; then display name, username and email, each with Edit, the email hidden until Reveal. Changing the
 * email sends a code to the new address (API 0.46.0); the server asks for the password again.
 */
export function AccountOverview({ email, onEmailChanged }: { email: string; onEmailChanged: (email: string) => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const me = useOrbit((s) => s.me);
  const photoRev = useOrbit((s) => (s.me ? s.users[s.me.userId]?.photoRev : null));
  const emailChange = useOrbit((s) => s.server?.features.includes("email-change") ?? false);
  const profilesRev = useOrbit((s) => s.profilesRev);
  const profile = useLoad(() => myProfile(engine), [engine, profilesRev]);
  const look = useUserLook(me?.userId ?? "");
  const [revealed, setRevealed] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const banner = me?.profileBanner ?? null;
  const bannerUrl = usePhoto("profileBanner", me?.userId ?? "", banner?.rev ?? null, banner?.kind === "gif" ? "image/gif" : banner?.kind === "webp" ? "image/webp" : "image/jpeg");
  if (!me) return null;
  // API 0.65.0: the profile theme first, then the name's colours (older servers: the accent).
  const colors = look.profileStyle?.themeColors ?? look.profileStyle?.nameColors ?? (look.profileStyle?.accent ? [look.profileStyle.accent] : null);
  const bannerStyle = bannerUrl
    ? { backgroundImage: `url(${bannerUrl})` }
    : { background: colors ? (colors.length > 1 ? `linear-gradient(120deg, ${colors.join(", ")})` : colors[0]) : "var(--brand-gradient)" };
  const displayName = profile.data?.displayName ?? me.displayName;
  return (
    <div className="card account-card">
      <div className="account-card-banner" style={bannerStyle} aria-hidden="true" />
      <div className="account-card-head">
        <span className="account-card-avatar">
          <LookAvatar userId={me.userId} name={me.displayName} colorIndex={me.avatarColor} photoRev={photoRev} size={84} online />
        </span>
        <span className="lines grow">
          <strong className="account-card-name">
            <StyledName name={displayName} style={look.profileStyle} tag={look.tag} className="ellipsis" />
          </strong>
          <small>@{me.username}</small>
        </span>
        <button className="btn btn-primary btn-sm" onClick={() => navigate({ section: "settings", settingsPage: "profile" })}>
          <Localized k="settings.interface.edit_profile_15c4aa1" />
        </button>
      </div>
      <div className="account-rows">
        <Row
          label={uiText("settings.interface.display_name_2b7f6a8")}
          value={
            displayName || (
              <span className="faint">
                <Localized k="settings.interface.you_haven_t_added_a_display_name_yet_cc3a8c2" />
              </span>
            )
          }
          onEdit={() => navigate({ section: "settings", settingsPage: "profile" })}
        />
        <Row label={l10n("auth.username")} value={me.username} onEdit={() => navigate({ section: "settings", settingsPage: "profile" })} />
        <Row
          label={l10n("auth.email")}
          value={
            <span className="row" style={{ gap: 8, alignItems: "center" }}>
              <span className="ellipsis">{revealed ? email : maskEmail(email)}</span>
              <button type="button" className="text-link" onClick={() => setRevealed((r) => !r)} aria-pressed={revealed}>
                {revealed ? <EyeOff size={13} aria-hidden="true" /> : <Eye size={13} aria-hidden="true" />}{" "}
                {revealed ? uiText("settings.interface.hide_ac20a57") : uiText("settings.interface.reveal_36b830b")}
              </button>
            </span>
          }
          onEdit={emailChange ? () => setEditing("email") : undefined}
        />
      </div>
      {editing === "email" && <EmailChangeDialog current={email} onClose={() => setEditing(null)} onChanged={onEmailChanged} />}
    </div>
  );
}
function Row({ label, value, onEdit }: { label: string; value: React.ReactNode; onEdit?: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  return (
    <div className="account-row">
      <span className="lines grow">
        <small className="account-row-label">{label}</small>
        <span className="account-row-value">{value}</span>
      </span>
      {onEdit && (
        <button className="btn btn-secondary btn-sm" onClick={onEdit} aria-label={uiText("settings.interface.edit_value0_44b87fe", { value0: label.toLowerCase() })}>
          <Pencil size={13} aria-hidden="true" /> {l10n("common.actions.edit")}
        </button>
      )}
    </div>
  );
}
/** Changing the email: the password and the new address, then the code sent there. */
function EmailChangeDialog({ current, onClose, onChanged }: { current: string; onClose: () => void; onChanged: (email: string) => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const api = new AccountSafetyApi(engine.api);
  const [step, setStep] = useState<
    | {
        k: "ask";
      }
    | {
        k: "code";
        masked: string;
      }
  >({ k: "ask" });
  const [password, setPassword] = useState("");
  const [next, setNext] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    fn()
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : uiText("workspace.interface.that_didn_t_work_try_again_5da2573")))
      .finally(() => setBusy(false));
  };
  const start = (e: FormEvent) => {
    e.preventDefault();
    if (!password || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.trim())) return setError(uiText("settings.interface.enter_your_password_and_the_new_address_bc287b9"));
    run(async () => {
      const r = await api.emailChangeStart(password, next.trim());
      setStep({ k: "code", masked: r.email });
    });
  };
  const confirm = (e: FormEvent) => {
    e.preventDefault();
    if (code.replace(/\D/g, "").length !== 6) return setError(uiText("settings.interface.enter_the_6_digit_code_d74d36e"));
    run(async () => {
      const r = await api.emailChangeConfirm(code);
      onChanged(r.email);
      engine.notice("info", uiText("settings.interface.your_email_address_was_changed_7556829"));
      onClose();
    });
  };
  return (
    <Dialog title={uiText("settings.interface.change_your_email_752b060")} onClose={onClose}>
      {step.k === "ask" ? (
        <form className="dialog-body" onSubmit={start} noValidate>
          <p className="muted" style={{ margin: 0 }}>
            <Localized k="settings.interface.we_ll_send_a_code_to_the_new_address_your_account_changes_over_on_5ad5a71" slots={[l10n("messaging.people_now"), maskEmail(current)]} />
          </p>
          <label className="field">
            <span>
              <Localized k="settings.interface.new_email_0d25c8b" />
            </span>
            <input className="input" type="email" autoComplete="email" value={next} onChange={(e) => setNext(e.target.value)} disabled={busy} data-autofocus />
          </label>
          <label className="field">
            <span>
              <Localized k="settings.interface.current_password_72ed2bd" />
            </span>
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
          </label>
          {error && (
            <div className="banner danger" role="alert">
              {error}
            </div>
          )}
          <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {l10n("common.actions.cancel")}
            </button>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? l10n("common.common_sending") : l10n("auth.forgot_button")}
            </button>
          </div>
        </form>
      ) : (
        <form className="dialog-body" onSubmit={confirm} noValidate>
          <p className="muted" style={{ margin: 0 }}>
            <Localized k="settings.interface.if_can_be_used_a_6_digit_code_is_on_its_way_there_it_works_for_30_963c8d0" slots={[step.masked]} />
          </p>
          <label className="field">
            <span>{l10n("common.common_code")}</span>
            <input className="input mono" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} disabled={busy} data-autofocus />
          </label>
          {error && (
            <div className="banner danger" role="alert">
              {error}
            </div>
          )}
          <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setStep({ k: "ask" })}>
              {l10n("common.actions.back")}
            </button>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? uiText("settings.interface.changing_92a0c89") : uiText("settings.interface.change_email_ff2ec26")}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
