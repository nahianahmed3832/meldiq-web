import { useState } from "react";
import { useEngine } from "../../application/orbit";
import { zConnections, socialError, socialProviderName, type SocialProvider } from "../../auth/socialAuth";
import { Dialog } from "../components/Overlay";
import { useLoad } from "../workspace/useLoad";
import { SocialSignIn } from "../auth/SocialSignIn";

export function ConnectedAccountsCard() {
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
      setNotice("Provider disconnected. Other sessions were signed out.");
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
      <h3 style={{ margin: 0 }}>Connected Accounts</h3>
      <p className="muted">Connect Google, Apple or Discord to sign in to this same Meldiq account.</p>
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
              <small>{identity ? `${identity.email ?? "Connected"} · Connected ${new Date(identity.connectedAt).toLocaleDateString()}` : "Not connected"}</small>
            </span>
            {identity ? (
              <button
                type="button"
                className="btn btn-danger-quiet btn-sm"
                disabled={last}
                title={last ? "Connect another provider or use Forgot password to set a password first." : undefined}
                onClick={() => setAction(provider)}
              >
                Disconnect
              </button>
            ) : (
              <button type="button" className="btn btn-secondary btn-sm" disabled={!list.data!.providers.includes(provider)} onClick={() => setAction("connect")}>
                Connect
              </button>
            )}
          </div>
        );
      })}
      {!list.data.password && <p className="muted">To add an email password, sign out and choose Forgot password with your account email. Keep a connected provider until the password is set.</p>}
      {action && (
        <Dialog title={action === "connect" ? "Connect a sign-in method" : `Disconnect ${socialProviderName(action)}?`} onClose={close}>
          <p>
            {action === "connect"
              ? "Confirm your password, or use a session you signed in to in the last five minutes."
              : "Another login method must remain. Disconnecting also signs out your other sessions."}
          </p>
          <label className="field">
            Current password (if you have one)
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label className="field">
            Authenticator code (if enabled)
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
                setNotice("Sign-in method connected to your Meldiq account.");
                list.reload();
              }}
            />
          ) : (
            <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void disconnect()}>
              {busy ? "Disconnecting…" : "Disconnect provider"}
            </button>
          )}
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={close}>
            Cancel
          </button>
        </Dialog>
      )}
    </div>
  );
}
