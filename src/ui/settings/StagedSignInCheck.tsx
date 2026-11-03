import { useEffect, useRef, useState, type FormEvent } from "react";
import { useEngine } from "../../application/orbit";
import { checkSupabaseSignIn } from "../../auth/supabasePreview";
import type { SupabasePreviewConfig } from "../../auth/supabasePreviewConfig";
import { sign } from "../../crypto/ed25519";

export default function StagedSignInCheck({ provider }: { provider: SupabasePreviewConfig }) {
  const engine = useEngine();
  const [password, setPassword] = useState("");
  const [legacyPassword, setLegacyPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      abort.current?.abort();
    };
  }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !password) return;
    const device = engine.device;
    if (!device.account) return;
    const owner = { accountId: device.account.id, userId: device.userId, deviceId: device.deviceId };
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setMessage(null);
    setFailed(false);
    try {
      if (!engine.session.token() && !(await engine.session.reauthenticate())) throw new Error("Session unavailable");
      const legacyAccessToken = engine.session.token();
      if (!legacyAccessToken) throw new Error("Session unavailable");
      await checkSupabaseSignIn({
        provider,
        store: engine.store,
        apiOrigin: engine.api.base || location.origin,
        owner,
        legacyAccessToken,
        email: device.account.email,
        password,
        legacyPassword: legacyPassword || password,
        totpCode: code || undefined,
        signal: controller.signal,
        isCurrentOwner: () => alive.current && engine.device.account?.id === owner.accountId && engine.device.userId === owner.userId && engine.device.deviceId === owner.deviceId,
        signDeviceProof: (message) => sign(device.keys.signing.privateKey, message),
      });
      if (alive.current) setMessage("Test sign-in verified and closed. Your current Meldiq session stays active.");
    } catch {
      if (alive.current) {
        setFailed(true);
        setMessage("The check could not finish. Check your test passwords and authenticator code, or try again.");
      }
    } finally {
      if (alive.current) {
        setBusy(false);
        setPassword("");
        setLegacyPassword("");
        setCode("");
      }
      if (abort.current === controller) abort.current = null;
    }
  };
  return (
    <section className="card" style={{ padding: 20, display: "grid", gap: 12 }} aria-label="Staging sign-in check">
      <h3 style={{ margin: 0 }}>Sign-in migration check</h3>
      <p className="muted">For staging test accounts only. Check that the updated sign-in matches your existing account and this browser. Your keys, chats and pending messages stay here.</p>
      <form onSubmit={(event) => void submit(event)} className="ws-form">
        <label className="field">
          <span>Test sign-in password</span>
          <input className="input" type="password" autoComplete="off" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={busy} />
        </label>
        <label className="field">
          <span>Current Meldiq password, if different</span>
          <input className="input" type="password" autoComplete="off" value={legacyPassword} onChange={(event) => setLegacyPassword(event.target.value)} disabled={busy} />
        </label>
        <label className="field">
          <span>Authenticator or backup code, if enabled</span>
          <input className="input" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} disabled={busy} />
        </label>
        <div className="ws-row">
          <button className="btn btn-secondary" type="submit" disabled={busy || !password}>
            {busy ? "Checking…" : "Check test sign-in"}
          </button>
          {busy && (
            <button className="btn btn-ghost" type="button" onClick={() => abort.current?.abort()}>
              Cancel
            </button>
          )}
        </div>
      </form>
      {message && (
        <p className={failed ? "banner danger" : "banner ok"} role={failed ? "alert" : "status"}>
          {message}
        </p>
      )}
    </section>
  );
}
