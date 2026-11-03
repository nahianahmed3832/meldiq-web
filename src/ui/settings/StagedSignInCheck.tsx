import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useEngine } from "../../application/orbit";
import { checkSupabaseSignIn } from "../../auth/supabasePreview";
import type { SupabasePreviewConfig } from "../../auth/supabasePreviewConfig";
import { sign } from "../../crypto/ed25519";
export default function StagedSignInCheck({ provider }: { provider: SupabasePreviewConfig }) {
  useLocaleRender();
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
      if (!engine.session.token() && !(await engine.session.reauthenticate())) throw new Error(uiText("settings.interface.session_unavailable_b4bc9ad"));
      const legacyAccessToken = engine.session.token();
      if (!legacyAccessToken) throw new Error(uiText("settings.interface.session_unavailable_b4bc9ad"));
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
      if (alive.current) setMessage(uiText("settings.interface.test_sign_in_verified_and_closed_your_current_meldiq_session_stays_a_8997e2f"));
    } catch {
      if (alive.current) {
        setFailed(true);
        setMessage(uiText("settings.interface.the_check_could_not_finish_check_your_test_passwords_and_authenticat_c02fbdd"));
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
    <section className="card" style={{ padding: 20, display: "grid", gap: 12 }} aria-label={uiText("settings.interface.staging_sign_in_check_cf30e56")}>
      <h3 style={{ margin: 0 }}>
        <Localized k="settings.interface.sign_in_migration_check_1c59446" />
      </h3>
      <p className="muted">
        <Localized k="settings.interface.for_staging_test_accounts_only_check_that_the_updated_sign_in_mat_30e2a48" />
      </p>
      <form onSubmit={(event) => void submit(event)} className="ws-form">
        <label className="field">
          <span>
            <Localized k="settings.interface.test_sign_in_password_848704d" />
          </span>
          <input className="input" type="password" autoComplete="off" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={busy} />
        </label>
        <label className="field">
          <span>
            <Localized k="settings.interface.current_meldiq_password_if_different_cc4a74c" />
          </span>
          <input className="input" type="password" autoComplete="off" value={legacyPassword} onChange={(event) => setLegacyPassword(event.target.value)} disabled={busy} />
        </label>
        <label className="field">
          <span>
            <Localized k="settings.interface.authenticator_or_backup_code_if_enabled_929147e" />
          </span>
          <input className="input" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} disabled={busy} />
        </label>
        <div className="ws-row">
          <button className="btn btn-secondary" type="submit" disabled={busy || !password}>
            {busy ? uiText("common.common_checking") : uiText("settings.interface.check_test_sign_in_8648231")}
          </button>
          {busy && (
            <button className="btn btn-ghost" type="button" onClick={() => abort.current?.abort()}>
              <Localized k="common.actions.cancel" />
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
