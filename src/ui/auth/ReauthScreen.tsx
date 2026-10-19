import { type FormEvent, useState } from "react";
import type { Engine } from "../../sync/engine";
import { AuthFrame, AuthHeading, FormError, LinkButton } from "./AuthFrame";
import { useSubmit } from "./useSubmit";

/**
 * The account session ended (it expired, was signed out from another device, or the password changed). The password,
 * with this browser's device key, starts a new one; messages and keys kept here stay as they are.
 */
export function ReauthScreen({ engine, onSignOut }: { engine: Engine; onSignOut: () => void }) {
  const [password, setPassword] = useState("");
  const { busy, error, setError, run } = useSubmit();
  const email = engine.device.account?.email ?? "";
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!password) return setError("Enter your password.");
    void run(() => engine.signInAgain(password));
  };
  return (
    <AuthFrame>
      <form className="auth-form" onSubmit={submit} noValidate>
        <AuthHeading title="Sign in again" sub={<>Your session on this browser ended. Enter the password for {email} to continue where you left off.</>} />
        <FormError text={error} />
        <input type="email" autoComplete="username" value={email} readOnly hidden />
        <div className="field">
          <label htmlFor="ra-password">Password</label>
          <input id="ra-password" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </div>
        <button className="btn btn-primary btn-lg" disabled={busy}>
          {busy ? "Signing in…" : "Continue"}
        </button>
        <div className="auth-links">
          <LinkButton onClick={onSignOut}>Sign out and erase this browser</LinkButton>
        </div>
      </form>
    </AuthFrame>
  );
}
