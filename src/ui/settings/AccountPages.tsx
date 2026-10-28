import { KeyRound, Laptop, LogOut, Smartphone, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { Device } from "../../api/schemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { listDevices, revokeDevice, signOut, SignOutUnconfirmed } from "../../sync/account";
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
          Every phone and browser signed in to your account. Each shows the same chats: they're kept on Meldiq's servers. Remove one to sign it out at once.
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
            <p style={{ margin: 0 }}>It's signed out at once and can't open your chats any more. Sign in there again to use it.</p>
          </div>
        </Dialog>
      )}
    </>
  );
}

export function SecurityPage({ onSignedOut }: { onSignedOut: () => void }) {
  const engine = useEngine();
  const me = useOrbit((s) => s.me);
  const [confirm, setConfirm] = useState<"ask" | "unconfirmed" | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  if (!me) return null;
  /**
   * [force]: even if the server can't confirm (asked first). Nothing needs backing up first: the server keeps every
   * message (API 0.57.0).
   */
  const doSignOut = (force: boolean) => {
    setBusy(true);
    signOut(engine, force, true)
      .then(onSignedOut)
      .catch((e: unknown) => {
        if (e instanceof SignOutUnconfirmed) {
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
        <strong>Where your data lives</strong>
        <ul className="muted" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6, fontSize: 13.5 }}>
          <li>Your messages, files and settings are stored on Meldiq's servers, so every device you sign in to shows the same chats. They travel over encrypted connections.</li>
          <li>This browser keeps only what signs it in. Nothing to back up, and nothing lost if this computer is.</li>
          <li>
            {engine.device.account
              ? "Your session is kept encrypted under a key this page can use but not read; if it ends, Meldiq asks for your password again. Your password itself is never stored."
              : "The session token is held in memory only; each visit signs in again with the device key."}
          </li>
        </ul>
      </div>
      <div className="card" style={{ padding: "16px 18px", display: "grid", gap: 12 }}>
        <div>
          <strong>Sign out of this browser</strong>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13.5 }}>
            This browser leaves your account and forgets its sign-in. Your chats stay on Meldiq's servers and are all there when you sign in again.
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
              <button className="btn btn-primary" disabled={busy} onClick={() => doSignOut(false)}>
                {busy ? "Signing out…" : "Sign out"}
              </button>
            </>
          }
        >
          <div className="dialog-body">
            <p style={{ margin: 0 }}>Your chats stay on Meldiq's servers and are all there when you sign in again.</p>
          </div>
        </Dialog>
      )}
      {confirm === "unconfirmed" && (
        <Dialog
          title="The server couldn't confirm"
          onClose={() => setConfirm(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setConfirm(null)}>
                Stay signed in
              </button>
              <button className="btn btn-danger" disabled={busy} onClick={() => doSignOut(true)}>
                Sign out anyway
              </button>
            </>
          }
        >
          <div className="dialog-body">
            <p style={{ margin: 0 }}>{reason}.</p>
            <p className="muted" style={{ margin: 0 }}>
              If you sign out now, the server still lists this browser as a device until you remove it in Settings › Devices on another of your devices.
            </p>
          </div>
        </Dialog>
      )}
    </>
  );
}
