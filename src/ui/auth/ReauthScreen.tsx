import { type FormEvent, useState } from "react";
import type { Engine } from "../../sync/engine";
import { AuthFrame, AuthHeading, FormError, LinkButton } from "./AuthFrame";
import { emailProblem, normalizeEmail } from "../../auth/rules";
import { useSubmit } from "./useSubmit";

/**
 * The account session ended (it expired, was signed out from another device, or the password changed). The password,
 * with this browser's device key, starts a new one; messages and keys kept here stay as they are.
 */
export function ReauthScreen({ engine, onSignOut }: { engine: Engine; onSignOut: () => void }) {
  const [password, setPassword] = useState("");
  const { busy, error, setError, run } = useSubmit();
  const email = engine.device.account?.email ?? "";
  // After an account recovery (a new address) the stored one no longer signs in: the person can type the new one.
  const [otherEmail, setOtherEmail] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (otherEmail !== null && emailProblem(otherEmail)) return setError(emailProblem(otherEmail));
    if (!password) return setError("Enter your password.");
    void run(() => engine.signInAgain(password, otherEmail !== null ? normalizeEmail(otherEmail) : undefined));
  };
  return (
    <AuthFrame>
      <form className="auth-form" onSubmit={submit} noValidate>
        <AuthHeading title="Sign in again" sub={<>Your session on this browser ended. Enter the password for {email} to continue where you left off.</>} />
        <FormError text={error} />
        {otherEmail === null ? (
          <input type="email" autoComplete="username" value={email} readOnly hidden />
        ) : (
          <div className="field">
            <label htmlFor="ra-email">Your account's email now</label>
            <input id="ra-email" className="input" type="email" autoComplete="username" value={otherEmail} onChange={(e) => setOtherEmail(e.target.value)} autoFocus />
            <span className="hint">This browser still proves it's one of your account's devices, so only your own account can continue here.</span>
          </div>
        )}
        <div className="field">
          <label htmlFor="ra-password">Password</label>
          <input id="ra-password" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </div>
        <button className="btn btn-primary btn-lg" disabled={busy}>
          {busy ? "Signing in…" : "Continue"}
        </button>
        <div className="auth-links">
          {otherEmail === null && <LinkButton onClick={() => setOtherEmail("")}>Your account uses a different email now?</LinkButton>}
          <LinkButton onClick={onSignOut}>Sign out and erase this browser</LinkButton>
        </div>
      </form>
    </AuthFrame>
  );
}
