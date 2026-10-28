import { KeyRound, Laptop, LogOut, Smartphone, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { Device } from "../../api/schemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { BackupUnsent, listDevices, revokeDevice, signOut, SignOutUnconfirmed } from "../../sync/account";
import { HistoryBackupCard, UnlockBackupDialog } from "./HistoryBackup";
import { BlockedPeople, MessagingSettings, PrivacySettings } from "./PrivacyPage";
import { Dialog } from "../components/Overlay";
import { relative } from "../format";

export function DevicesPage() {
  const engine = useEngine();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remove, setRemove] = useState<Device | null>(null);
  const load = useCallback(() => {
    listDevices(engine)
      .then((d) => {
        setDevices(d);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't load devices"));
  }, [engine]);
  useEffect(load, [load]);
  const active = (devices ?? []).filter((d) => !d.revokedAt);
  return (
    <>
      <div>
        <h1>Devices</h1>
        <p className="muted" style={{ margin: "6px 0 0" }}>
          Every device of your account gets its own keys and its own copy of each message. To add a browser, sign in there and set it up with your recovery key or by approving it on your phone.
        </p>
      </div>
      {error && <div className="banner danger">{error}</div>}
      <div className="card">
        {!devices && !error && <span className="skeleton" style={{ display: "block", height: 120, margin: 16 }} />}
        {active.map((d) => (
          <div key={d.id} className="setting">
            <span className="empty-orb" style={{ width: 40, height: 40 }}>
              {/^(Meldiq|Orbit) Web/.test(d.name) ? <Laptop size={18} /> : <Smartphone size={18} />}
            </span>
            <div className="lines">
              <strong className="ellipsis">{d.name}</strong>
              <small>
                {d.current ? "This browser" : d.lastSeenAt ? `Last active ${relative(d.lastSeenAt)}` : "Never connected"} · linked {relative(d.createdAt)}
              </small>
            </div>
            {d.current ? (
              <span className="tag ok">This browser</span>
            ) : (
              <button className="btn btn-danger-quiet btn-sm" onClick={() => setRemove(d)}>
                <Trash2 size={14} /> Remove
              </button>
            )}
          </div>
        ))}
      </div>
      {remove && (
        <Dialog
          title={`Remove ${remove.name}?`}
          onClose={() => setRemove(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setRemove(null)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  const d = remove;
                  setRemove(null);
                  revokeDevice(engine, d.id)
                    .then(load)
                    .catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't remove the device"));
                }}
              >
                Remove device
              </button>
            </>
          }
        >
          <div className="dialog-body">
            <p style={{ margin: 0 }}>It's signed out at once and stops receiving new messages. Messages already on it aren't erased remotely.</p>
            <p className="faint" style={{ margin: 0 }}>
              If it's your only phone and you don't have your recovery key, you can't get your account back on a new phone. Keep at least one phone linked.
            </p>
          </div>
        </Dialog>
      )}
    </>
  );
}

export function SecurityPage({ onSignedOut }: { onSignedOut: () => void }) {
  const engine = useEngine();
  const me = useOrbit((s) => s.me);
  const [confirm, setConfirm] = useState<"ask" | "unconfirmed" | "unsent" | "unlock" | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [needsKeys, setNeedsKeys] = useState(false);
  if (!me) return null;
  /** [force]: even if the server can't confirm; [skipBackup]: even if chats couldn't be backed up (both asked first). */
  const doSignOut = (force: boolean, skipBackup: boolean) => {
    setBusy(true);
    signOut(engine, force, skipBackup)
      .then(onSignedOut)
      .catch((e: unknown) => {
        if (e instanceof BackupUnsent) {
          setReason(e.message);
          setNeedsKeys(e.needsKeys);
          setConfirm("unsent");
        } else if (e instanceof SignOutUnconfirmed) {
          setReason(e.message);
          setConfirm("unconfirmed");
        } else engine.notice("error", e instanceof Error ? e.message : "Couldn't sign out");
      })
      .finally(() => setBusy(false));
  };
  return (
    <>
      <h1>Privacy & security</h1>
      <div className="card">
        <div className="setting">
          <KeyRound size={20} className="faint" />
          <div className="lines">
            <strong>This browser's device key</strong>
            <small>What your other device showed when it approved this browser.</small>
            <span className="fingerprint" style={{ fontSize: 13 }}>
              {me.deviceFingerprint}
            </span>
          </div>
        </div>
      </div>
      <MessagingSettings />
      <PrivacySettings />
      <BlockedPeople />
      <div className="card" style={{ padding: "16px 18px", display: "grid", gap: 10 }}>
        <strong>How this browser protects your messages</strong>
        <ul className="muted" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6, fontSize: 13.5 }}>
          <li>Messages and files are encrypted and decrypted here, with keys this page can use but can't read or export.</li>
          <li>The server relays ciphertext. It sees who talks to whom and when, not what is said.</li>
          <li>This browser doesn't keep your recovery key: it's shown once when it's made, or typed in to set the browser up, and dropped right after. This browser can't approve other devices.</li>
          <li>
            Messages this browser received are kept in its storage on this computer so they're there next time, and backed up end-to-end encrypted on your server. That storage isn't as strongly
            protected as your phone's encrypted database: sign out on shared computers.
          </li>
          <li>
            {engine.device.account
              ? "Your account session is kept encrypted under a key this page can use but not read; if it ends, Meldiq asks for your password again. Your password itself is never stored."
              : "The session token is held in memory only; each visit signs in again with the device key."}
          </li>
        </ul>
      </div>
      <HistoryBackupCard />
      <div className="card" style={{ padding: "16px 18px", display: "grid", gap: 12 }}>
        <div>
          <strong>Sign out of this browser</strong>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13.5 }}>
            Your chats are backed up first, so they come back when you sign in again. Then this browser leaves your account and its keys and its copy of your chats are removed from this computer.
          </p>
        </div>
        <div>
          <button className="btn btn-secondary" onClick={() => setConfirm("ask")} disabled={busy}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </div>
      {confirm === "ask" && (
        <Dialog
          title="Sign out of this browser?"
          onClose={() => setConfirm(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" disabled={busy} onClick={() => doSignOut(false, false)}>
                {busy ? "Signing out…" : "Sign out"}
              </button>
            </>
          }
        >
          <div className="dialog-body">
            <p style={{ margin: 0 }}>Your chats stay backed up, end-to-end encrypted, and come back when you sign in again.</p>
          </div>
        </Dialog>
      )}
      {confirm === "unsent" && (
        <Dialog
          title="Some chats aren't backed up yet"
          onClose={() => setConfirm(null)}
          footer={
            <>
              <button className="btn btn-secondary" disabled={busy} onClick={() => doSignOut(true, true)}>
                Sign out anyway
              </button>
              {needsKeys ? (
                <button className="btn btn-primary" onClick={() => setConfirm("unlock")}>
                  Back up first
                </button>
              ) : (
                <button className="btn btn-primary" disabled={busy} onClick={() => doSignOut(false, false)}>
                  {busy ? "Trying…" : "Try again"}
                </button>
              )}
            </>
          }
        >
          <div className="dialog-body">
            <p style={{ margin: 0 }}>{reason}</p>
            <p className="muted" style={{ margin: 0 }}>
              If you sign out now, chats that only this browser has won't come back here. Chats your phone or another device has are kept.
            </p>
          </div>
        </Dialog>
      )}
      {confirm === "unlock" && <UnlockBackupDialog onClose={() => setConfirm(null)} onDone={() => doSignOut(false, false)} />}
      {confirm === "unconfirmed" && (
        <Dialog
          title="The server couldn't confirm"
          onClose={() => setConfirm(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setConfirm(null)}>
                Stay signed in
              </button>
              <button className="btn btn-danger" disabled={busy} onClick={() => doSignOut(true, true)}>
                Sign out anyway
              </button>
            </>
          }
        >
          <div className="dialog-body">
            <p style={{ margin: 0 }}>{reason}.</p>
            <p className="muted" style={{ margin: 0 }}>
              If you sign out now, the server still lists this browser as a device until you remove it in Settings › Devices on your phone, and new messages keep being encrypted to it (nobody can read
              them without its keys, which are removed).
            </p>
          </div>
        </Dialog>
      )}
    </>
  );
}
