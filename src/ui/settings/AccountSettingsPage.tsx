import { KeyRound, Laptop, LogOut, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate } from "../../application/router";
import { myProfile } from "../../sync/profile";
import { AccountApi } from "../../auth/accountApi";
import { canDeleteAccount, type DeletionProblem, deletionProblem, deletionProblemText } from "../../auth/deleteAccount";
import { PASSWORD_MIN_LENGTH, passwordProblem } from "../../auth/rules";
import { deleteAccount } from "../../sync/account";
import { relative } from "../format";
import { useAction, useLoad } from "../workspace/useLoad";
import { KeyBackupCard } from "./KeyBackupCard";
import { RecoveryCodesCard } from "./RecoveryCodesCard";

/**
 * The Orbit 2.0 account (docs/ORBIT_2_ARCHITECTURE §2): its email, the password, and where it's signed in. A browser
 * linked before 2.0 has no account here and is told how to get one.
 */
export function AccountSettingsPage({ onSignedOut }: { onSignedOut: () => void }) {
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
  // Grouped as on Android (2026-10-23): account information, how you sign in, account management.
  return (
    <>
      <h1>Account</h1>
      <h2 className="settings-group">Account information</h2>
      <AccountInformation email={account.email} />
      <h2 className="settings-group">How you sign in</h2>
      <ChangePassword email={account.email} />
      <KeyBackupCard />
      <RecoveryCodesCard />
      <Sessions accounts={new AccountApi(engine.api)} />
      <h2 className="settings-group">Account management</h2>
      <DeleteAccount email={account.email} onDeleted={onSignedOut} />
    </>
  );
}

/** Who the account is (android Account information): username, display name, email and the phone from the profile. */
function AccountInformation({ email }: { email: string }) {
  const engine = useEngine();
  const me = useOrbit((s) => s.me);
  const profilesRev = useOrbit((s) => s.profilesRev);
  const profile = useLoad(() => myProfile(engine), [engine, profilesRev]);
  const rows: [string, string | null][] = [
    ["Username", me ? `@${me.username}` : null],
    ["Display name", me?.displayName ?? null],
    ["Email", email],
    ["Phone", profile.data ? (profile.data.phone ?? "Not added") : null],
  ];
  return (
    <div className="card account-info">
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value ?? <span className="skeleton" style={{ width: 120, height: 14, display: "inline-block" }} />}</dd>
          </div>
        ))}
      </dl>
      <p className="faint" style={{ margin: 0, fontSize: 12.5 }}>
        Change your name, username and phone in{" "}
        <button className="text-link" onClick={() => navigate({ section: "settings", settingsPage: "profile" })}>
          Profile
        </button>
        .
      </p>
    </div>
  );
}

/** Deleting the account for good (server docs/ACCOUNT_DELETION.md); this browser erases its copy once the server confirms. */
function DeleteAccount({ email, onDeleted }: { email: string; onDeleted: () => void }) {
  const engine = useEngine();
  const available = engine.state.get().server?.features.includes("account-delete") ?? false;
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
      setProblem(deletionProblem(err));
    });
  };
  return (
    <div className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
      <h3 style={{ margin: 0 }}>
        <Trash2 size={16} style={{ verticalAlign: "-3px" }} /> Delete account
      </h3>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        Deletes the Meldiq account {email} for good. You leave every workspace, group and channel, every device is signed out and your profile is erased. It can't be undone.
      </p>
      <p className="faint" style={{ margin: 0, fontSize: 12.5 }}>
        People you messaged keep the conversation, shown as "Deleted account". Messages already delivered stay on their devices. Once the server confirms, this browser erases its copy too.
      </p>
      {!available && (
        <div className="banner" role="status">
          This server can't delete accounts yet.
        </div>
      )}
      {available && !open && (
        <div>
          <button className="btn btn-danger-quiet btn-sm" onClick={() => setOpen(true)}>
            Delete my account…
          </button>
        </div>
      )}
      {available && open && (
        <form onSubmit={submit} className="ws-form" noValidate>
          <label className="field">
            <span>Type your email to confirm</span>
            <input className="input" type="email" autoComplete="off" placeholder={email} value={typed} onChange={(e) => setTyped(e.target.value)} disabled={busy} />
          </label>
          <label className="field">
            <span>Current password</span>
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
          </label>
          {problem && (
            <div className="banner danger ws-wide" role="alert">
              {deletionProblemText(problem)}
            </div>
          )}
          <div className="ws-form-actions">
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setOpen(false)}>
              Keep my account
            </button>
            <button className="btn btn-danger btn-sm" disabled={busy || !canDeleteAccount(typed, email, password)}>
              {busy ? "Deleting…" : "Delete my account"}
            </button>
          </div>
        </form>
      )}
    </div>
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
        Changing it signs out every other session of your account. This browser stays signed in. This browser doesn't keep your account's keys, so your key backup turns off until your phone signs in
        with the new password, which backs the keys up again.
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
