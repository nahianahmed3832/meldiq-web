import { useT as useLocalization } from "../../i18n";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { PlatformInbox } from "../operations/PlatformInbox";
import { Copy, ShieldCheck, ShieldAlert } from "lucide-react";
import { type FormEvent, useState } from "react";
import { ApiError } from "../../api/client";
import { useEngine, useOrbit } from "../../application/orbit";
import { AccountSafetyApi, STANDING_LEVELS, type StandingLevel } from "../../sync/accountSafety";
import { relative, untilWhen } from "../format";
import { QrCode } from "../components/QrCode";
import { useLoad } from "../workspace/useLoad";
/**
 * Settings › My Account › Two-step sign-in (API 0.46.0): a code from an authenticator app at every password sign-in.
 * Set up with the password, a QR code (or the key typed in) and the app's first code; ten backup codes are shown once.
 * Turning it off needs the password and a code. Before it's turned on, the card says what it means for the Android app.
 */
export function TwoStepCard() {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const api = new AccountSafetyApi(engine.api);
  const [version, setVersion] = useState(0);
  const status = useLoad(() => api.totpStatus(), [version]);
  const [step, setStep] = useState<"idle" | "password" | "scan" | "codes" | "off">("idle");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [secret, setSecret] = useState<{
    secret: string;
    uri: string;
  } | null>(null);
  const [backup, setBackup] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const s = status.data;
  const run = (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    fn()
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : uiText("workspace.interface.that_didn_t_work_try_again_5da2573")))
      .finally(() => setBusy(false));
  };
  const reset = () => {
    setStep("idle");
    setPassword("");
    setCode("");
    setSecret(null);
    setError(null);
  };
  const begin = (e: FormEvent) => {
    e.preventDefault();
    if (!password) return setError(uiText("auth.signin_enter_password"));
    run(async () => {
      setSecret(await api.totpSetup(password));
      setPassword("");
      setStep("scan");
    });
  };
  const confirm = (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.replace(/\s/g, ""))) return setError(uiText("settings.interface.enter_the_6_digit_code_your_app_shows_e306451"));
    run(async () => {
      setBackup((await api.totpEnable(code.replace(/\s/g, ""))).backupCodes);
      setCode("");
      setStep("codes");
      setVersion((v) => v + 1);
    });
  };
  const turnOff = (e: FormEvent) => {
    e.preventDefault();
    if (!password || !code.trim()) return setError(uiText("settings.interface.enter_your_password_and_a_code_0a660ec"));
    run(async () => {
      await api.totpDisable(password, code.trim());
      reset();
      setVersion((v) => v + 1);
      engine.notice("info", uiText("settings.interface.two_step_sign_in_is_off_723d6be"));
    });
  };
  return (
    <div className="card setting-card">
      <div className="setting-card-head">
        <span className="lines grow">
          <strong>
            <Localized k="settings.interface.two_step_sign_in_5c4b3bf" slots={[s?.enabled ? uiText("settings.interface.on_1300117") : uiText("messaging.interface.off_ca7981b")]} />
          </strong>
          <small>
            <Localized k="settings.interface.add_a_code_from_an_authenticator_app_google_authenticator_authy_1_3e69d19" />
          </small>
        </span>
        {s && !s.enabled && step === "idle" && (
          <button className="btn btn-primary btn-sm" disabled={!s.available} onClick={() => setStep("password")}>
            <Localized k="settings.interface.turn_on_5a1f096" />
          </button>
        )}
        {s?.enabled && step === "idle" && (
          <button className="btn btn-secondary btn-sm" onClick={() => setStep("off")}>
            <Localized k="settings.interface.turn_off_06f0e21" />
          </button>
        )}
      </div>
      {s && !s.available && (
        <small className="faint">
          <Localized k="settings.interface.this_server_can_t_turn_on_two_step_sign_in_yet_it_has_no_key_to_p_98ccd05" />
        </small>
      )}
      {s?.enabled && step === "idle" && (
        <small className="faint">
          <Localized
            k="settings.interface.on_since_backup_left_ec7cf0e"
            slots={[
              s.enabledAt ? relative(s.enabledAt) : uiText("settings.interface.earlier_2a51d35"),
              s.backupCodesLeft,
              s.backupCodesLeft === 1 ? uiText("settings.interface.code_5694d08") : uiText("settings.interface.codes_64a7994"),
            ]}
          />
        </small>
      )}
      {error && (
        <div className="banner danger" role="alert">
          {error}
        </div>
      )}
      {step === "password" && (
        <form className="ws-form" onSubmit={begin} noValidate>
          <div className="banner warn ws-wide" role="note">
            <Localized k="settings.interface.the_meldiq_android_app_can_t_ask_for_these_codes_yet_while_two_st_51cd30d" />
          </div>
          <label className="field">
            <span>
              <Localized k="settings.interface.current_password_72ed2bd" />
            </span>
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} autoFocus />
          </label>
          <div className="ws-form-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
              {l10n("common.actions.cancel")}
            </button>
            <button className="btn btn-primary btn-sm" disabled={busy}>
              {busy ? l10n("common.common_checking") : l10n("common.actions.continue")}
            </button>
          </div>
        </form>
      )}
      {step === "scan" && secret && (
        <form className="two-step-scan" onSubmit={confirm} noValidate>
          <QrCode text={secret.uri} size={168} label={uiText("settings.interface.qr_code_for_your_authenticator_app_def58af")} />
          <div className="lines">
            <strong>
              <Localized k="settings.interface.scan_this_with_your_authenticator_app_c5fcfbb" />
            </strong>
            <small className="faint">
              <Localized k="settings.interface.or_type_this_key_into_it_c841da9" />
            </small>
            <code className="two-step-key">{secret.secret.match(/.{1,4}/g)?.join(" ")}</code>
            <label className="field">
              <span>
                <Localized k="settings.interface.then_enter_the_6_digit_code_it_shows_463dda6" />
              </span>
              <input className="input mono" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} disabled={busy} autoFocus />
            </label>
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
                {l10n("common.actions.cancel")}
              </button>
              <button className="btn btn-primary btn-sm" disabled={busy}>
                {busy ? uiText("settings.interface.turning_on_63fd4df") : uiText("settings.interface.turn_on_5a1f096")}
              </button>
            </div>
          </div>
        </form>
      )}
      {step === "codes" && (
        <div className="two-step-codes">
          <strong>
            <Localized k="settings.interface.two_step_sign_in_is_on_save_these_backup_codes_now_dea2b4e" />
          </strong>
          <small className="faint">
            <Localized k="settings.interface.each_works_once_if_you_lose_your_phone_they_won_t_be_shown_again_7132df6" />
          </small>
          <ul className="recovery-codes" aria-label={uiText("settings.interface.backup_codes_a13fe23")}>
            {backup.map((c) => (
              <li key={c} className="mono">
                {c}
              </li>
            ))}
          </ul>
          <div className="row" style={{ gap: 8 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                void navigator.clipboard?.writeText(backup.join("\n")).catch(() => undefined);
                engine.notice("info", uiText("settings.interface.backup_codes_copied_bd40e3b"));
              }}
            >
              <Copy size={14} /> {l10n("common.actions.copy")}
            </button>
            <button className="btn btn-primary btn-sm" onClick={reset}>
              <Localized k="settings.interface.i_ve_saved_them_578d17a" />
            </button>
          </div>
        </div>
      )}
      {step === "off" && (
        <form className="ws-form" onSubmit={turnOff} noValidate>
          <label className="field">
            <span>
              <Localized k="settings.interface.current_password_72ed2bd" />
            </span>
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} autoFocus />
          </label>
          <label className="field">
            <span>
              <Localized k="settings.interface.code_from_your_app_or_a_backup_code_cf106d4" />
            </span>
            <input className="input mono" autoComplete="one-time-code" maxLength={20} value={code} onChange={(e) => setCode(e.target.value)} disabled={busy} />
          </label>
          <div className="ws-form-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
              <Localized k="settings.interface.keep_it_on_cbfff78" />
            </button>
            <button className="btn btn-danger btn-sm" disabled={busy}>
              {busy ? uiText("settings.interface.turning_off_c62412a") : uiText("settings.interface.turn_off_06f0e21")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
const LEVEL_TEXT: Record<
  StandingLevel,
  {
    title: string;
    sub: string;
  }
> = {
  good: {
    get title() {
      return uiText("settings.interface.your_account_is_all_good_f4cd5d8");
    },
    get sub() {
      return uiText("settings.interface.everything_works_normally_7390443");
    },
  },
  limited: {
    get title() {
      return uiText("settings.interface.your_account_is_limited_8111b8f");
    },
    get sub() {
      return uiText("settings.interface.you_can_t_start_communities_or_make_invitations_until_the_warning_00bd404");
    },
  },
  very_limited: {
    get title() {
      return uiText("settings.interface.your_account_is_very_limited_fb6ffa4");
    },
    get sub() {
      return uiText("settings.interface.you_also_can_t_start_new_conversations_or_join_communities_until_5833581");
    },
  },
  suspended: {
    get title() {
      return uiText("settings.interface.your_account_is_suspended_355a68d");
    },
    get sub() {
      return uiText("settings.interface.you_can_read_but_you_can_t_send_messages_until_a_warning_ends_61fe117");
    },
  },
};
const LEVEL_SHORT: Record<StandingLevel, string> = {
  get good() {
    return uiText("settings.interface.all_good_9ca4e31");
  },
  get limited() {
    return uiText("settings.interface.limited_e5125d9");
  },
  get very_limited() {
    return uiText("settings.interface.very_limited_20f48a7");
  },
  get suspended() {
    return uiText("settings.interface.suspended_e392a38");
  },
};
/** Settings › My Account › Account standing (API 0.46.0): where the account is on the scale, and why. */
export function StandingCard() {
  useLocaleRender();
  const engine = useEngine();
  const offered = useOrbit((s) => s.server?.features.includes("account-standing") ?? false);
  const standing = useLoad(() => (offered ? new AccountSafetyApi(engine.api).standing() : Promise.resolve(null)), [engine, offered]);
  if (!offered) return null;
  const st = standing.data;
  const level = st?.level ?? "good";
  const at = STANDING_LEVELS.indexOf(level);
  return (
    <section className="card setting-card" aria-label={uiText("settings.interface.account_standing_be12fbd")}>
      <strong>
        <Localized k="settings.interface.account_standing_be12fbd" />
      </strong>
      <div className="standing-head">
        <span className={`standing-icon ${level}`} aria-hidden="true">
          {level === "good" ? <ShieldCheck size={22} /> : <ShieldAlert size={22} />}
        </span>
        <span className="lines">
          <strong>{LEVEL_TEXT[level].title}</strong>
          <small className="faint">{LEVEL_TEXT[level].sub}</small>
        </span>
      </div>
      <ol className="standing-scale" aria-label={uiText("settings.interface.standing_value0_9620107", { value0: LEVEL_SHORT[level] })}>
        {STANDING_LEVELS.map((l, i) => (
          <li key={l} className={`${i <= at ? "reached" : ""}${i === at ? " current" : ""}`} aria-current={i === at ? "step" : undefined}>
            <span className="standing-dot" aria-hidden="true" />
            <small>{LEVEL_SHORT[l]}</small>
          </li>
        ))}
      </ol>
      {st && st.warnings.length > 0 && (
        <ul className="standing-warnings" aria-label={uiText("settings.interface.active_warnings_5579c54")}>
          {st.warnings.map((w) => (
            <li key={w.id}>
              <strong>{w.reason}</strong>
              <small className="faint">
                <Localized k="settings.interface.ends_492e049" slots={[untilWhen(w.expiresAt)]} />
              </small>
            </li>
          ))}
        </ul>
      )}
      <ul className="standing-rules faint">
        <li>
          <Localized k="settings.interface.warnings_from_meldiq_s_staff_count_for_a_set_number_of_days_then_64bb483" />
        </li>
        <li>
          <Localized k="settings.interface.one_warning_limits_your_account_two_limit_it_more_three_suspend_i_b21cc68" />
        </li>
      </ul>
      <PlatformInbox />
    </section>
  );
}
