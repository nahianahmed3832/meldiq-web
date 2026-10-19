import { KeyRound, Laptop, LogOut } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useEngine } from "../../app/orbit";
import { AccountApi } from "../../auth/accountApi";
import { PASSWORD_MIN_LENGTH, passwordProblem } from "../../auth/rules";
import { relative } from "../format";
import { useAction, useLoad } from "../workspace/useLoad";
import { RecoveryCodesCard } from "./RecoveryCodesCard";

/**
 * The Orbit 2.0 account (docs/ORBIT_2_ARCHITECTURE §2): its email, the password, and where it's signed in. A browser
 * linked before 2.0 has no account here and is told how to get one.
 */
export function AccountSettingsPage() {
  const engine = useEngine();
  const account = engine.device.account;
  if (!account) {
    return (
      <>
        <h1>Account</h1>
        <div className="card" style={{ padding: 20, display: "grid", gap: 10 }}>
          <p style={{ margin: 0 }}>This browser was linked to your account with your phone, before email sign-in existed. It has no email or password here.</p>
          <p className="muted" style={{ margin: 0 }}>
            On your phone, move your account to email sign-in (Meldiq asks when you update). Then sign out here and sign in with your email to manage your account from this browser.
          </p>
        </div>
      </>
    );
  }
  return (
    <>
      <h1>Account</h1>
      <div className="card" style={{ padding: 20, display: "grid", gap: 6 }}>
        <span className="faint" style={{ fontSize: 12.5 }}>
          Email
        </span>
        <strong>{account.email}</strong>
      </div>
      <ChangePassword email={account.email} />
      <RecoveryCodesCard />
      <Sessions accounts={new AccountApi(engine.api)} />
    </>
  );
}

function ChangePassword({ email }: { email: string }) {
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
        <KeyRound size={16} style={{ verticalAlign: "-3px" }} /> Password
      </h3>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        Changing it signs out every other session of your account. This browser stays signed in.
      </p>
      <form onSubmit={submit} className="ws-form" noValidate>
        <input type="email" autoComplete="username" value={email} readOnly hidden />
        <label className="field">
          <span>Current password</span>
          <input className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </label>
        <label className="field">
          <span>New password</span>
          <input className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </label>
        <p className="faint ws-wide" style={{ margin: 0, fontSize: 12.5 }}>
          At least {PASSWORD_MIN_LENGTH} characters.
        </p>
        {(act.error || problem) && (
          <div className="banner danger ws-wide" role="alert">
            {act.error ?? problem}
          </div>
        )}
        {done && (
          <div className="banner ok ws-wide" role="status">
            Password changed. Your other sessions were signed out.
          </div>
        )}
        <div className="ws-form-actions">
          <button className="btn btn-primary btn-sm" disabled={!current || !next || !!problem || act.busy}>
            {act.busy ? "Saving…" : "Change password"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Sessions({ accounts }: { accounts: AccountApi }) {
  const [version, setVersion] = useState(0);
  const list = useLoad(() => accounts.sessions(), [version]);
  const act = useAction();
  return (
    <div className="card" style={{ padding: 20, display: "grid", gap: 10 }}>
      <h3 style={{ margin: 0 }}>Where you're signed in</h3>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        Sessions of your account. Signing one out keeps that device's keys; it needs your password to come back. To remove a device and its keys, use Devices.
      </p>
      {(list.error || act.error) && (
        <div className="banner danger" role="alert">
          {list.error ?? act.error}
        </div>
      )}
      <ul className="ws-list" aria-label="Sessions" aria-busy={list.loading}>
        {(list.data ?? []).map((s) => (
          <li key={s.id} className="ws-row">
            <Laptop size={18} className="faint" />
            <span className="lines grow">
              <span className="ellipsis">{s.label ?? "Unnamed device"}</span>
              <small>
                Signed in {relative(s.createdAt)}
                {s.lastUsedAt ? ` · last used ${relative(s.lastUsedAt)}` : ""}
              </small>
            </span>
            {s.current ? (
              <span className="status-badge status-active">This browser</span>
            ) : (
              <button className="btn btn-ghost btn-sm" disabled={act.busy} onClick={() => void act.act(() => accounts.endSession(s.id).then(() => setVersion((v) => v + 1)))}>
                <LogOut size={14} /> Sign out
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
