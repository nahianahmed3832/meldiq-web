import { CloudUpload, History, TriangleAlert } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { ApiError } from "../../api/client";
import { useEngine, useOrbit } from "../../application/orbit";
import { AccountApi } from "../../auth/accountApi";
import { openKeyBackupWithCode } from "../../auth/deviceSetup";
import { decodeRecoveryCode } from "../../crypto/recoveryCode";
import type { HistoryBackupState } from "../../state/store";
import { Dialog } from "../components/Overlay";
import { relative } from "../format";

/**
 * Settings › Privacy & security › Chat history (2026-10-28): this browser's chats are backed up, end-to-end encrypted, in
 * the account's history on its server, so signing out loses nothing and every sign-in brings them back. Says how the
 * backup stands, turns it on for a browser set up before it existed, and restores from the server on request.
 */
export function HistoryBackupCard() {
  const engine = useEngine();
  const history = useOrbit((s) => s.history);
  const [unlocking, setUnlocking] = useState(false);
  const { backup } = history;
  if (!engine.device.history || history.status === "unsupported") return null;
  const restoring = history.status === "running";
  return (
    <div className="card" style={{ padding: "16px 18px", display: "grid", gap: 12 }}>
      <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
        <History size={18} className="faint" style={{ marginTop: 2 }} />
        <div style={{ display: "grid", gap: 4 }}>
          <strong>Chat history</strong>
          <span className="muted" style={{ fontSize: 13.5 }}>
            Your chats are kept end-to-end encrypted on your server, so they come back whenever you sign in, here or on another device. Only your devices and your recovery key can read them.
          </span>
          <span role="status" style={{ fontSize: 13.5 }}>
            {backupLine(backup)}
          </span>
        </div>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        {backup.mode === "needs-keys" && (
          <button className="btn btn-primary btn-sm" onClick={() => setUnlocking(true)}>
            <CloudUpload size={14} /> Back up this browser's chats
          </button>
        )}
        <button className="btn btn-secondary btn-sm" disabled={restoring} onClick={() => void engine.runHistory(true)}>
          {restoring ? "Restoring…" : "Restore chats from the server"}
        </button>
      </div>
      {history.status === "done" && history.restored > 0 && <small className="muted">{history.restored} messages restored on this browser.</small>}
      {history.status === "error" && history.error && <small className="danger-text">Not restored: {history.error}</small>}
      {unlocking && <UnlockBackupDialog onClose={() => setUnlocking(false)} />}
    </div>
  );
}

function backupLine(b: HistoryBackupState): string {
  if (b.mode === "needs-keys") return "This browser was set up before it could back up its own chats. Turn it on once with your password.";
  if (b.mode === "off") return "Checking…";
  if (b.error) return `${b.pending} messages waiting to be backed up: ${b.error}`;
  if (b.pending > 0) return `Backing up ${b.pending} messages…`;
  return b.lastUploadAt ? `All of this browser's chats are backed up (last ${relative(b.lastUploadAt)}).` : "All of this browser's chats are backed up.";
}

/**
 * Turns the backup on for a browser set up before 2026-10-28: its history key could only read. The key backup (the
 * password and an emailed code) or the recovery key opens the account's seed once; the keys made from it stay here, the
 * seed is wiped.
 */
export function UnlockBackupDialog({ onClose, onDone }: { onClose: () => void; onDone?: () => void }) {
  const engine = useEngine();
  const accounts = useRef(new AccountApi(engine.api)).current;
  const accountId = engine.device.account?.id ?? null;
  const [useRecoveryKey, setUseRecoveryKey] = useState(!accountId);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sent = useRef(false);

  const sendCode = () => {
    setError(null);
    accounts
      .startKeyUnlock()
      .then((r) => setSentTo(r.email))
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.code === "no_key_backup") setUseRecoveryKey(true);
        setError(e instanceof ApiError && e.code === "no_key_backup" ? "Your account has no key backup yet: use your recovery key." : e instanceof Error ? e.message : "Couldn't send the code.");
      });
  };
  useEffect(() => {
    if (useRecoveryKey || sent.current) return;
    sent.current = true;
    sendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- emails the code once when the email way opens
  }, [useRecoveryKey]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    let seed: Uint8Array | null = null;
    try {
      if (useRecoveryKey) {
        seed = await decodeRecoveryCode(recoveryKey);
        if (!seed) throw new Error("That isn't a recovery key. Check it and try again.");
      } else {
        if (!accountId) throw new Error("Use your recovery key on this browser.");
        seed = await openKeyBackupWithCode(accounts, accountId, code, password);
      }
      await engine.unlockHistoryBackup(seed);
      onDone?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't turn the backup on.");
    } finally {
      seed?.fill(0);
      setBusy(false);
    }
  };
  const ready = useRecoveryKey ? recoveryKey.trim().length > 0 : code.replace(/\D/g, "").length === 6 && password.length > 0;
  return (
    <Dialog
      title="Back up this browser's chats"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" form="unlock-backup" disabled={busy || !ready}>
            {busy ? "Turning on…" : "Turn on backup"}
          </button>
        </>
      }
    >
      <form id="unlock-backup" className="dialog-body" onSubmit={(e) => void submit(e)} noValidate>
        <p style={{ margin: 0 }}>
          This browser was set up before it could back up its own chats. Unlock your keys once and it backs up everything it holds, end-to-end encrypted, so those chats come back whenever you sign in.
        </p>
        {error && (
          <div className="banner danger" role="alert">
            <TriangleAlert size={16} /> {error}
          </div>
        )}
        {useRecoveryKey ? (
          <label className="field">
            <span>Recovery key</span>
            <textarea className="textarea mono" rows={2} value={recoveryKey} onChange={(e) => setRecoveryKey(e.target.value)} autoComplete="off" spellCheck={false} data-autofocus />
          </label>
        ) : (
          <>
            <p className="muted" role="status" style={{ margin: 0 }}>
              {sentTo ? `We emailed a 6-digit code to ${sentTo}.` : "Emailing you a code…"}
            </p>
            <label className="field">
              <span>Code from the email</span>
              <input className="input mono" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} data-autofocus />
            </label>
            <label className="field">
              <span>Password</span>
              <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
          </>
        )}
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          {!useRecoveryKey && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={sendCode}>
              Send a new code
            </button>
          )}
          {accountId && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setUseRecoveryKey((v) => !v)}>
              {useRecoveryKey ? "Use my password instead" : "Use my recovery key instead"}
            </button>
          )}
        </div>
      </form>
    </Dialog>
  );
}
