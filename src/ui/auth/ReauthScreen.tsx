import { type FormEvent, useState } from "react";
import type { Engine } from "../../sync/engine";
import { AuthFrame, AuthHeading, FormError, LinkButton } from "./AuthFrame";
import { emailProblem, normalizeEmail } from "../../auth/rules";
import { useSubmit } from "./useSubmit";
import { useT } from "../../i18n";
import { ApiError } from "../../api/client";

/**
 * The account session ended (it expired, was signed out from another device, or the password changed). The password,
 * with this browser's device key, starts a new one; messages and keys kept here stay as they are.
 */
export function ReauthScreen({ engine, onSignOut }: { engine: Engine; onSignOut: () => void }) {
  const [password, setPassword] = useState("");
  const { busy, error, setError, run } = useSubmit();
  const t = useT();
  const email = engine.device.account?.email ?? "";
  // After an account recovery (a new address) the stored one no longer signs in: the person can type the new one.
  const [otherEmail, setOtherEmail] = useState<string | null>(null);
  // API 0.46.0: with two-step sign-in on, the authenticator app's code (or a backup code) too.
  const [code, setCode] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (otherEmail !== null && emailProblem(otherEmail)) return setError(emailProblem(otherEmail));
    if (!password) return setError(t("signin_enter_password"));
    void run(async () => {
      try {
        await engine.signInAgain(password, otherEmail !== null ? normalizeEmail(otherEmail) : undefined, code?.trim() || undefined);
      } catch (err) {
        if (err instanceof ApiError && err.code === "totp_required") return setCode("");
        throw err;
      }
    });
  };
  return (
    <AuthFrame>
      <form className="auth-form" onSubmit={submit} noValidate>
        <AuthHeading title={t("reauth_title")} sub={t("reauth_sub", { email })} />
        <FormError text={error} />
        {otherEmail === null ? (
          <input type="email" autoComplete="username" value={email} readOnly hidden />
        ) : (
          <div className="field">
            <label htmlFor="ra-email">{t("reauth_email_now")}</label>
            <input id="ra-email" className="input" type="email" autoComplete="username" value={otherEmail} onChange={(e) => setOtherEmail(e.target.value)} autoFocus />
            <span className="hint">This browser still proves it's one of your account's devices, so only your own account can continue here.</span>
          </div>
        )}
        <div className="field">
          <label htmlFor="ra-password">{t("common_password")}</label>
          <input id="ra-password" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </div>
        {code !== null && (
          <div className="field">
            <label htmlFor="ra-code">Code from your authenticator app</label>
            <input
              id="ra-code"
              className="input mono"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456 or a backup code"
              maxLength={20}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
            />
          </div>
        )}
        <button className="btn btn-primary btn-lg" disabled={busy}>
          {busy ? t("signin_busy") : t("common_continue")}
        </button>
        <div className="auth-links">
          {otherEmail === null && <LinkButton onClick={() => setOtherEmail("")}>{t("reauth_other_email")}</LinkButton>}
          <LinkButton onClick={onSignOut}>{t("reauth_sign_out")}</LinkButton>
        </div>
      </form>
    </AuthFrame>
  );
}
