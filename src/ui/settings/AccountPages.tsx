import { KeyRound, Laptop, LogOut, Smartphone, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { Device } from "../../api/schemas";
import { useEngine, useOrbit } from "../../app/orbit";
import { fingerprint } from "../../crypto/identity";
import { listDevices, revokeDevice, signOut, SignOutUnconfirmed, updateProfile } from "../../sync/account";
import { Avatar } from "../components/Avatar";
import { Dialog } from "../components/Overlay";
import { relative } from "../format";

export function ProfilePage() {
  const engine = useEngine();
  const me = useOrbit((s) => s.me);
  const [name, setName] = useState(me?.displayName ?? "");
  const [status, setStatus] = useState(me?.statusText ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setName(me?.displayName ?? "");
    setStatus(me?.statusText ?? "");
  }, [me?.displayName, me?.statusText]);
  if (!me) return null;
  const dirty = name.trim() !== me.displayName || (status.trim() || null) !== (me.statusText ?? null);
  return (
    <>
      <h1>Profile</h1>
      <div className="card" style={{ padding: 20, display: "grid", gap: 16 }}>
        <div className="row" style={{ gap: 14 }}>
          <Avatar name={name || me.displayName} colorIndex={me.avatarColor} size={56} decorative />
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{name || me.displayName}</div>
            <div className="faint">@{me.username}</div>
          </div>
        </div>
        <form
          style={{ display: "grid", gap: 14 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return setError("Your name can't be empty.");
            setSaving(true);
            setError(null);
            updateProfile(engine, { displayName: name.trim(), statusText: status.trim() || null })
              .then(() => {
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
              })
              .catch((err: unknown) => setError(err instanceof Error ? err.message : "Couldn't save"))
              .finally(() => setSaving(false));
          }}
        >
          <div className="field">
            <label htmlFor="pf-name">Display name</label>
            <input id="pf-name" className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="pf-status">Status</label>
            <input id="pf-status" className="input" value={status} maxLength={140} placeholder="What are you up to?" onChange={(e) => setStatus(e.target.value)} />
            <span className="hint">Who sees your status follows your privacy settings on your phone.</span>
          </div>
          {error && <div className="banner danger">{error}</div>}
          <div className="row">
            <span className="faint grow" style={{ fontSize: 12.5 }}>
              Your username, photo and privacy choices are changed on your phone.
            </span>
            <button className="btn btn-primary" disabled={!dirty || saving}>
              {saved ? "Saved" : saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

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
          Every device of your account gets its own keys and its own copy of each message. Link another browser from its link screen and approve it on your phone.
        </p>
      </div>
      {error && <div className="banner danger">{error}</div>}
      <div className="card">
        {!devices && !error && <span className="skeleton" style={{ display: "block", height: 120, margin: 16 }} />}
        {active.map((d) => (
          <div key={d.id} className="setting">
            <span className="empty-orb" style={{ width: 40, height: 40 }}>
              {/Orbit Web/.test(d.name) ? <Laptop size={18} /> : <Smartphone size={18} />}
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
  const [identityFp, setIdentityFp] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"ask" | "unconfirmed" | null>(null);
  const [busy, setBusy] = useState(false);
  const [unconfirmedReason, setUnconfirmedReason] = useState("");
  useEffect(() => {
    if (me) void fingerprint(me.identityKey).then(setIdentityFp);
  }, [me]);
  if (!me) return null;
  const doSignOut = (force: boolean) => {
    setBusy(true);
    signOut(engine, force)
      .then(onSignedOut)
      .catch((e: unknown) => {
        if (e instanceof SignOutUnconfirmed) {
          setUnconfirmedReason(e.message);
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
            <small>What your phone showed when you approved this browser.</small>
            <span className="fingerprint" style={{ fontSize: 13 }}>
              {me.deviceFingerprint}
            </span>
          </div>
        </div>
        <div className="setting">
          <KeyRound size={20} className="faint" />
          <div className="lines">
            <strong>Your account's identity</strong>
            <small>Half of every safety number you compare with someone.</small>
            <span className="fingerprint" style={{ fontSize: 13 }}>
              {identityFp ?? "…"}
            </span>
          </div>
        </div>
      </div>
      <div className="card" style={{ padding: "16px 18px", display: "grid", gap: 10 }}>
        <strong>How this browser protects your messages</strong>
        <ul className="muted" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6, fontSize: 13.5 }}>
          <li>Messages and files are encrypted and decrypted here, with keys this page can use but can't read or export.</li>
          <li>The server relays ciphertext. It sees who talks to whom and when, not what is said.</li>
          <li>Your recovery key never comes to the browser. This browser can't approve other devices.</li>
          <li>
            Messages this browser received are kept in its storage on this computer so they're there next time. That storage isn't as strongly protected as your phone's encrypted database: sign out on
            shared computers.
          </li>
          <li>The session token is held in memory only; each visit signs in again with the device key.</li>
        </ul>
      </div>
      <div className="card" style={{ padding: "16px 18px", display: "grid", gap: 12, borderColor: "var(--danger-soft)" }}>
        <div>
          <strong>Sign out of this browser</strong>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13.5 }}>
            Removes this browser from your account (contacts stop encrypting to it), then erases its keys and every message it kept. Your phone and other devices keep theirs.
          </p>
        </div>
        <div>
          <button className="btn btn-danger" onClick={() => setConfirm("ask")} disabled={busy}>
            <LogOut size={16} /> Sign out and erase this browser
          </button>
        </div>
      </div>
      {confirm === "ask" && (
        <Dialog
          title="Sign out and erase this browser?"
          onClose={() => setConfirm(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" disabled={busy} onClick={() => doSignOut(false)}>
                {busy ? "Signing out…" : "Sign out"}
              </button>
            </>
          }
        >
          <div className="dialog-body">
            <p style={{ margin: 0 }}>To use Orbit here again you'll link this browser from your phone.</p>
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
                Keep this browser
              </button>
              <button className="btn btn-danger" disabled={busy} onClick={() => doSignOut(true)}>
                Erase anyway
              </button>
            </>
          }
        >
          <div className="dialog-body">
            <p style={{ margin: 0 }}>{unconfirmedReason}.</p>
            <p className="muted" style={{ margin: 0 }}>
              If you erase now, the server still lists this browser as a device until you remove it in Settings › Devices on your phone, and new messages keep being encrypted to it (nobody can read
              them without its keys, which are erased).
            </p>
          </div>
        </Dialog>
      )}
    </>
  );
}
