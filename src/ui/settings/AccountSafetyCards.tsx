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
  const engine = useEngine();
  const api = new AccountSafetyApi(engine.api);
  const [version, setVersion] = useState(0);
  const status = useLoad(() => api.totpStatus(), [version]);
  const [step, setStep] = useState<"idle" | "password" | "scan" | "codes" | "off">("idle");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [secret, setSecret] = useState<{ secret: string; uri: string } | null>(null);
  const [backup, setBackup] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const s = status.data;
  const run = (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    fn()
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "That didn't work. Try again."))
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
    if (!password) return setError("Enter your password.");
    run(async () => {
      setSecret(await api.totpSetup(password));
      setPassword("");
      setStep("scan");
    });
  };
  const confirm = (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.replace(/\s/g, ""))) return setError("Enter the 6-digit code your app shows.");
    run(async () => {
      setBackup((await api.totpEnable(code.replace(/\s/g, ""))).backupCodes);
      setCode("");
      setStep("codes");
      setVersion((v) => v + 1);
    });
  };
  const turnOff = (e: FormEvent) => {
    e.preventDefault();
    if (!password || !code.trim()) return setError("Enter your password and a code.");
    run(async () => {
      await api.totpDisable(password, code.trim());
      reset();
      setVersion((v) => v + 1);
      engine.notice("info", "Two-step sign-in is off.");
    });
  };

  return (
    <div className="card setting-card">
      <div className="setting-card-head">
        <span className="lines grow">
          <strong>Two-step sign-in · {s?.enabled ? "On" : "Off"}</strong>
          <small>Add a code from an authenticator app (Google Authenticator, Authy, 1Password and others) to every sign-in with your password.</small>
        </span>
        {s && !s.enabled && step === "idle" && (
          <button className="btn btn-primary btn-sm" disabled={!s.available} onClick={() => setStep("password")}>
            Turn on
          </button>
        )}
        {s?.enabled && step === "idle" && (
          <button className="btn btn-secondary btn-sm" onClick={() => setStep("off")}>
            Turn off
          </button>
        )}
      </div>
      {s && !s.available && <small className="faint">This server can't turn on two-step sign-in yet (it has no key to protect the secret).</small>}
      {s?.enabled && step === "idle" && (
        <small className="faint">
          On since {s.enabledAt ? relative(s.enabledAt) : "earlier"}. {s.backupCodesLeft} backup {s.backupCodesLeft === 1 ? "code" : "codes"} left.
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
            The Meldiq Android app can't ask for these codes yet. While two-step sign-in is on, signing in on Android with your password won't work (devices already signed in stay signed in, and
            passkeys still work).
          </div>
          <label className="field">
            <span>Current password</span>
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} autoFocus />
          </label>
          <div className="ws-form-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
              Cancel
            </button>
            <button className="btn btn-primary btn-sm" disabled={busy}>
              {busy ? "Checking…" : "Continue"}
            </button>
          </div>
        </form>
      )}
      {step === "scan" && secret && (
        <form className="two-step-scan" onSubmit={confirm} noValidate>
          <QrCode text={secret.uri} size={168} label="QR code for your authenticator app" />
          <div className="lines">
            <strong>Scan this with your authenticator app</strong>
            <small className="faint">Or type this key into it:</small>
            <code className="two-step-key">{secret.secret.match(/.{1,4}/g)?.join(" ")}</code>
            <label className="field">
              <span>Then enter the 6-digit code it shows</span>
              <input className="input mono" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} disabled={busy} autoFocus />
            </label>
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
                Cancel
              </button>
              <button className="btn btn-primary btn-sm" disabled={busy}>
                {busy ? "Turning on…" : "Turn on"}
              </button>
            </div>
          </div>
        </form>
      )}
      {step === "codes" && (
        <div className="two-step-codes">
          <strong>Two-step sign-in is on. Save these backup codes now.</strong>
          <small className="faint">Each works once, if you lose your phone. They won't be shown again.</small>
          <ul className="recovery-codes" aria-label="Backup codes">
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
                engine.notice("info", "Backup codes copied.");
              }}
            >
              <Copy size={14} /> Copy
            </button>
            <button className="btn btn-primary btn-sm" onClick={reset}>
              I've saved them
            </button>
          </div>
        </div>
      )}
      {step === "off" && (
        <form className="ws-form" onSubmit={turnOff} noValidate>
          <label className="field">
            <span>Current password</span>
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} autoFocus />
          </label>
          <label className="field">
            <span>Code from your app, or a backup code</span>
            <input className="input mono" autoComplete="one-time-code" maxLength={20} value={code} onChange={(e) => setCode(e.target.value)} disabled={busy} />
          </label>
          <div className="ws-form-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
              Keep it on
            </button>
            <button className="btn btn-danger btn-sm" disabled={busy}>
              {busy ? "Turning off…" : "Turn off"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

const LEVEL_TEXT: Record<StandingLevel, { title: string; sub: string }> = {
  good: { title: "Your account is all good", sub: "Everything works normally." },
  limited: { title: "Your account is limited", sub: "You can't start communities or make invitations until the warning ends." },
  very_limited: { title: "Your account is very limited", sub: "You also can't start new conversations or join communities until a warning ends." },
  suspended: { title: "Your account is suspended", sub: "You can read, but you can't send messages until a warning ends." },
};
const LEVEL_SHORT: Record<StandingLevel, string> = { good: "All good", limited: "Limited", very_limited: "Very limited", suspended: "Suspended" };

/** Settings › My Account › Account standing (API 0.46.0): where the account is on the scale, and why. */
export function StandingCard() {
  const engine = useEngine();
  const offered = useOrbit((s) => s.server?.features.includes("account-standing") ?? false);
  const standing = useLoad(() => (offered ? new AccountSafetyApi(engine.api).standing() : Promise.resolve(null)), [engine, offered]);
  if (!offered) return null;
  const st = standing.data;
  const level = st?.level ?? "good";
  const at = STANDING_LEVELS.indexOf(level);
  return (
    <div className="card setting-card">
      <strong>Account standing</strong>
      <div className="standing-head">
        <span className={`standing-icon ${level}`} aria-hidden="true">
          {level === "good" ? <ShieldCheck size={22} /> : <ShieldAlert size={22} />}
        </span>
        <span className="lines">
          <strong>{LEVEL_TEXT[level].title}</strong>
          <small className="faint">{LEVEL_TEXT[level].sub}</small>
        </span>
      </div>
      <ol className="standing-scale" aria-label={`Standing: ${LEVEL_SHORT[level]}`}>
        {STANDING_LEVELS.map((l, i) => (
          <li key={l} className={`${i <= at ? "reached" : ""}${i === at ? " current" : ""}`} aria-current={i === at ? "step" : undefined}>
            <span className="standing-dot" aria-hidden="true" />
            <small>{LEVEL_SHORT[l]}</small>
          </li>
        ))}
      </ol>
      {st && st.warnings.length > 0 && (
        <ul className="standing-warnings" aria-label="Active warnings">
          {st.warnings.map((w) => (
            <li key={w.id}>
              <strong>{w.reason}</strong>
              <small className="faint">Ends {untilWhen(w.expiresAt)}</small>
            </li>
          ))}
        </ul>
      )}
      <ul className="standing-rules faint">
        <li>Warnings from Meldiq's staff count for a set number of days, then stop counting by themselves.</li>
        <li>One warning limits your account, two limit it more, three suspend it.</li>
      </ul>
    </div>
  );
}
