import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { interfaceLocale } from "../../i18n/format";
import { useT as useLocalization } from "../../i18n";
import { useState } from "react";
import { useEngine } from "../../application/orbit";
import { zConnections, socialError, socialProviderName, type SocialProvider } from "../../auth/socialAuth";
import { Dialog } from "../components/Overlay";
import { useLoad } from "../workspace/useLoad";
import { SocialSignIn } from "../auth/SocialSignIn";
export function ConnectedAccountsCard() {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const list = useLoad(() => engine.api.json("GET", "/v2/account/identities", zConnections), [engine]);
  const [action, setAction] = useState<"connect" | SocialProvider | null>(null);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const close = () => {
    setAction(null);
    setPassword("");
    setCode("");
    setError(null);
  };
  const disconnect = async () => {
    if (!action || action === "connect") return;
    setBusy(true);
    setError(null);
    try {
      await engine.api.call("DELETE", `/v2/account/identities/${action}`, { body: { password: password || undefined, totpCode: code || undefined } });
      close();
      setNotice(uiText("settings.interface.provider_disconnected_other_sessions_were_signed_out_1336232"));
      list.reload();
    } catch (e) {
      setError(socialError(e));
    } finally {
      setBusy(false);
    }
  };
  // An older server has no provider API. Existing email settings remain usable.
  if (!list.data) return null;
  return (
    <div className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
      <h3 style={{ margin: 0 }}>
        <Localized k="settings.interface.connected_accounts_6a376da" />
      </h3>
      <p className="muted">
        <Localized k="settings.interface.connect_google_apple_or_discord_to_sign_in_to_this_same_meldiq_ac_dc476dd" />
      </p>
      {notice && (
        <p role="status" className="banner ok">
          {notice}
        </p>
      )}
      {(["google", "apple", "discord"] as const).map((provider) => {
        const identity = list.data!.identities.find((i) => i.provider === provider);
        const last = !list.data!.password && list.data!.identities.length < 2;
        return (
          <div key={provider} className="ws-row">
            <span className="grow">
              <strong>{socialProviderName(provider)}</strong>
              <br />
              <small>
                {identity
                  ? uiText("settings.interface.value0_connected_value1_2fea3e0", {
                      value0: identity.email ?? l10n("calls.connected"),
                      value1: new Date(identity.connectedAt).toLocaleDateString(interfaceLocale()),
                    })
                  : uiText("settings.interface.not_connected_0303e18")}
              </small>
            </span>
            {identity ? (
              <button
                type="button"
                className="btn btn-danger-quiet btn-sm"
                disabled={last}
                title={last ? uiText("settings.interface.connect_another_provider_or_use_forgot_password_to_set_a_password_e8c3620") : undefined}
                onClick={() => setAction(provider)}
              >
                <Localized k="calls.interface.disconnect_acfc5be" />
              </button>
            ) : (
              <button type="button" className="btn btn-secondary btn-sm" disabled={!list.data!.providers.includes(provider)} onClick={() => setAction("connect")}>
                <Localized k="files.interface.connect_1a2303e" />
              </button>
            )}
          </div>
        );
      })}
      {!list.data.password && (
        <p className="muted">
          <Localized k="settings.interface.to_add_an_email_password_sign_out_and_choose_forgot_password_with_2d877ed" />
        </p>
      )}
      {action && (
        <Dialog
          title={action === "connect" ? uiText("settings.interface.connect_a_sign_in_method_ea8c5f1") : uiText("settings.interface.disconnect_value0_51710a5", { value0: socialProviderName(action) })}
          onClose={close}
        >
          <p>
            {action === "connect"
              ? uiText("settings.interface.confirm_your_password_or_use_a_session_you_signed_in_to_in_the_la_6aee094")
              : uiText("settings.interface.another_login_method_must_remain_disconnecting_also_signs_out_you_ed9170b")}
          </p>
          <label className="field">
            <Localized k="settings.interface.current_password_if_you_have_one_dd4d105" />
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label className="field">
            <Localized k="settings.interface.authenticator_code_if_enabled_23e2232" />
            <input className="input" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          {error && (
            <p role="alert" className="banner danger">
              {error}
            </p>
          )}
          {action === "connect" ? (
            <SocialSignIn
              api={engine.api}
              mode="link"
              password={password}
              totpCode={code}
              onLinked={() => {
                close();
                setNotice(uiText("settings.interface.sign_in_method_connected_to_your_meldiq_account_f98eaae"));
                list.reload();
              }}
            />
          ) : (
            <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void disconnect()}>
              {busy ? uiText("settings.interface.disconnecting_cb2b6a5") : uiText("settings.interface.disconnect_provider_5941d42")}
            </button>
          )}
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={close}>
            {l10n("common.actions.cancel")}
          </button>
        </Dialog>
      )}
    </div>
  );
}
