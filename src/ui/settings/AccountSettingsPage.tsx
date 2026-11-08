import { PasswordInput } from "../components/PasswordInput";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { MigrationPreviewCard } from "./MigrationPreviewCard";
import { KeyRound, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { AccountApi } from "../../auth/accountApi";
import { canDeleteAccount, type DeletionProblem, deletionProblem, deletionProblemText } from "../../auth/deleteAccount";
import { PASSWORD_MIN_LENGTH, passwordProblem } from "../../auth/rules";
import { deleteAccount } from "../../sync/account";
import { useAction } from "../workspace/useLoad";
import { KeyBackupCard } from "./KeyBackupCard";
import { PasskeysCard } from "./PasskeysCard";
import { RecoveryCodesCard } from "./RecoveryCodesCard";
import { AccountOverview } from "./AccountOverview";
import { StandingCard, TwoStepCard } from "./AccountSafetyCards";
import { DataExportCard } from "./AccountExtrasCards";
import { CreatorVerificationCard } from "./CreatorVerificationCard";
/**
 * The Orbit 2.0 account (docs/ORBIT_2_ARCHITECTURE §2): its email, the password, and where it's signed in. A browser
 * linked before 2.0 has no account here and is told how to get one.
 */
export function AccountSettingsPage({ onSignedOut }: { onSignedOut: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const account = engine.device.account;
  if (!account) {
    return (
      <>
        <h1>{l10n("settings.account")}</h1>
        <div className="card" style={{ padding: 20, display: "grid", gap: 10 }}>
          <p style={{ margin: 0 }}>
            <Localized k="settings.interface.this_browser_was_linked_to_your_account_with_your_phone_before_em_bb40d77" />
          </p>
          <p className="muted" style={{ margin: 0 }}>
            <Localized k="settings.interface.on_your_phone_move_your_account_to_email_sign_in_meldiq_asks_when_70a3300" />
          </p>
        </div>
      </>
    );
  }
  return <MyAccount email={account.email} onSignedOut={onSignedOut} />;
}
/**
 * Settings › My Account (the reference's page, 2026-10-28): your card with name, username and email; password, two-step
 * sign-in, passkeys and keys; account standing; bug hunting; your data; then signing out everywhere and deleting the
 * account.
 */
function MyAccount({ email: initialEmail, onSignedOut }: { email: string; onSignedOut: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const [email, setEmail] = useState(initialEmail);
  return (
    <>
      <h1>{l10n("settings.settings_account")}</h1>
      <AccountOverview
        email={email}
        onEmailChanged={(next) => {
          setEmail(next);
          void engine.accountEmailChanged(next);
        }}
      />
      <StandingCard />
      <CreatorVerificationCard />
      <h2 className="settings-group">
        <Localized k="settings.interface.your_data_ee5ef73" />
      </h2>
      <DataExportCard />
      <h2 className="settings-group">{l10n("settings.account")}</h2>
      <DeleteAccount email={email} onDeleted={onSignedOut} />
    </>
  );
}
/** Deleting the account for good (server docs/ACCOUNT_DELETION.md); this browser erases its copy once the server confirms. */
function DeleteAccount({ email, onDeleted }: { email: string; onDeleted: () => void }) {
  useLocaleRender();
  const engine = useEngine();
  const available = useOrbit((s) => s.server?.features.includes("account-delete") ?? false);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<DeletionProblem | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canDeleteAccount(typed, email, password) || busy) return;
    setBusy(true);
    setProblem(null);
    deleteAccount(engine, password, typed).then(onDeleted, (err: unknown) => {
      setBusy(false);
      setPassword("");
      setProblem(deletionProblem(err));
    });
  };
  return (
    <div className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
      <h3 style={{ margin: 0 }}>
        <Localized k="settings.interface.delete_account_cff0651" slots={[<Trash2 size={16} style={{ verticalAlign: "-3px" }} />]} />
      </h3>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        <Localized k="settings.interface.deletes_the_meldiq_account_for_good_you_leave_every_community_gro_dfd49f8" slots={[email]} />
      </p>
      <p className="faint" style={{ margin: 0, fontSize: 12.5 }}>
        <Localized k="settings.interface.people_you_messaged_keep_the_conversation_shown_as_deleted_accoun_ffcc0b2" />
      </p>
      {!available && (
        <div className="banner" role="status">
          <Localized k="settings.interface.this_server_can_t_delete_accounts_yet_0930b77" />
        </div>
      )}
      {available && !open && (
        <div>
          <button className="btn btn-danger-quiet btn-sm" onClick={() => setOpen(true)}>
            <Localized k="settings.interface.delete_my_account_28a415f" />
          </button>
        </div>
      )}
      {available && open && (
        <form onSubmit={submit} className="ws-form" noValidate>
          <label className="field">
            <span>
              <Localized k="settings.interface.type_your_email_to_confirm_552d00d" />
            </span>
            <input className="input" type="email" autoComplete="off" placeholder={email} value={typed} onChange={(e) => setTyped(e.target.value)} disabled={busy} />
          </label>
          <label className="field">
            <span>
              <Localized k="settings.interface.current_password_72ed2bd" />
            </span>
            <PasswordInput className="input" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
          </label>
          {problem && (
            <div className="banner danger ws-wide" role="alert">
              {deletionProblemText(problem)}
            </div>
          )}
          <div className="ws-form-actions">
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { setOpen(false); setTyped(""); setPassword(""); setProblem(null); }}>
              <Localized k="settings.interface.keep_my_account_d62ce03" />
            </button>
            <button className="btn btn-danger btn-sm" disabled={busy || !canDeleteAccount(typed, email, password)}>
              {busy ? uiText("organization.interface.deleting_43b5894") : uiText("settings.interface.delete_my_account_21d5294")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
function ChangePassword({ email }: { email: string }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [done, setDone] = useState(false);
  const act = useAction();
  const problem = next ? passwordProblem(next, email) : null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!current || !next || problem) return;
    void act.act(async () => {
      await new AccountApi(engine.api).changePassword(current, next);
      setCurrent("");
      setNext("");
      setDone(true);
    });
  };
  return (
    <div className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
      <h3 style={{ margin: 0 }}>
        <KeyRound size={16} style={{ verticalAlign: "-3px" }} /> {l10n("auth.password")}
      </h3>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        <Localized k="settings.interface.changing_it_signs_out_every_other_session_of_your_account_this_br_aa7368b" />
      </p>
      <form onSubmit={submit} className="ws-form" noValidate>
        <input type="email" autoComplete="username" value={email} readOnly hidden />
        <label className="field">
          <span>
            <Localized k="settings.interface.current_password_72ed2bd" />
          </span>
          <PasswordInput className="input" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </label>
        <label className="field">
          <span>{l10n("auth.reset_new_password")}</span>
          <PasswordInput className="input" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </label>
        <p className="faint ws-wide" style={{ margin: 0, fontSize: 12.5 }}>
          <Localized k="settings.interface.at_least_characters_04a49b7" slots={[PASSWORD_MIN_LENGTH]} />
        </p>
        {(act.error || problem) && (
          <div className="banner danger ws-wide" role="alert">
            {act.error ?? problem}
          </div>
        )}
        {done && (
          <div className="banner ok ws-wide" role="status">
            <Localized k="settings.interface.password_changed_your_other_sessions_were_signed_out_2804304" />
          </div>
        )}
        <div className="ws-form-actions">
          <button className="btn btn-primary btn-sm" disabled={!current || !next || !!problem || act.busy}>
            {act.busy ? l10n("common.common_saving") : uiText("settings.interface.change_password_3f9c991")}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Authentication has one home under Privacy & Security. */
export function AuthenticationSettings() {
  const engine = useEngine();
  const twoStep = useOrbit((s) => s.server?.features.includes("two-step") ?? false);
  if (!engine.device.account) return null;
  return (
    <>
      <h2 className="settings-group">
        <Localized k="settings.interface.password_and_authentication_7f183b0" />
      </h2>
      <MigrationPreviewCard />
      <ChangePassword email={engine.device.account.email} />
      {twoStep && <TwoStepCard />}
      <PasskeysCard />
      <KeyBackupCard />
      <RecoveryCodesCard />
    </>
  );
}
