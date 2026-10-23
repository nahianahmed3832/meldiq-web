import { KeyRound, Trash2 } from "lucide-react";
import { useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { AccountApi, type Passkey } from "../../auth/accountApi";
import { addPasskey, PasskeyCancelled, passkeyRpId } from "../../auth/passkeys";
import { browserLabel } from "../../sync/session";
import { authErrorText } from "../auth/useSubmit";
import { dayLabel, relative } from "../format";
import { useLoad } from "../workspace/useLoad";

/** One passkey's line under its name: when it was added, last used, and whether the password manager syncs it. */
export function passkeyDetails(p: Passkey, now = Date.now()): string {
  const used = p.lastUsedAt ? `used ${relative(p.lastUsedAt, now)}` : "never used";
  return [`Added ${dayLabel(p.createdAt, now)}`, used, ...(p.synced ? ["synced"] : [])].join(" · ");
}

/**
 * Passkeys (android Settings › Account › Passkeys, server docs/PASSKEYS.md): sign in without the password, unlocked by
 * this computer's screen lock or a phone. Listed with the ones made in the apps; the web makes its own, for its own
 * address. Hidden unless the server offers passkeys to this page's origin.
 */
export function PasskeysCard() {
  const engine = useEngine();
  const rpId = passkeyRpId(useOrbit((s) => s.server));
  const accounts = new AccountApi(engine.api);
  const [version, setVersion] = useState(0);
  const list = useLoad(() => accounts.passkeys(), [engine, version]);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  if (!rpId || list.data?.available === false) return null;
  const passkeys = list.data?.passkeys ?? [];

  const run = (fn: () => Promise<string | null>) => {
    setBusy(true);
    setMessage(null);
    fn()
      .then((done) => {
        if (done) setMessage({ text: done, ok: true });
        setVersion((v) => v + 1);
      })
      .catch((e: unknown) => {
        if (!(e instanceof PasskeyCancelled)) setMessage({ text: authErrorText(e), ok: false });
      })
      .finally(() => {
        setBusy(false);
        setRemoving(null);
      });
  };
  const add = () => run(async () => (await addPasskey(accounts, rpId, browserLabel()), "Passkey added. Next time, sign in with it instead of your password."));
  const remove = (id: string) => run(async () => (await accounts.removePasskey(id), null));

  return (
    <div className="card" style={{ padding: 20, display: "grid", gap: 12 }} aria-label="Passkeys">
      <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
        <KeyRound size={18} className="faint" style={{ marginTop: 2 }} />
        <div className="grow" style={{ display: "grid", gap: 4 }}>
          <strong>Passkeys</strong>
          <span className="muted" style={{ fontSize: 13 }}>
            {passkeys.length
              ? "Sign in with your screen lock or your phone instead of your password. A passkey only signs in: your messages stay protected by this browser's keys."
              : "Forget about your password: add a passkey and sign in with your screen lock or your phone. It only signs in; your messages stay protected by this browser's keys."}
          </span>
          <span className="faint" style={{ fontSize: 12.5 }}>
            Passkeys made in the Meldiq app work in the app. Meldiq Web uses its own, made here; your password manager may sync them to your other computers.
          </span>
        </div>
      </div>
      {list.error && (
        <div className="banner danger" role="alert">
          {list.error}
        </div>
      )}
      {message && (
        <div className={`banner ${message.ok ? "ok" : "danger"}`} role={message.ok ? "status" : "alert"}>
          {message.text}
        </div>
      )}
      {passkeys.length > 0 && (
        <ul className="passkey-list" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
          {passkeys.map((p) => (
            <li key={p.id} className="row" style={{ gap: 10, alignItems: "center" }}>
              <div className="grow" style={{ display: "grid", gap: 2, minWidth: 0 }}>
                <span>{p.name}</span>
                <span className="faint" style={{ fontSize: 12.5 }}>
                  {passkeyDetails(p)}
                </span>
              </div>
              {removing === p.id ? (
                <>
                  <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setRemoving(null)}>
                    Keep
                  </button>
                  <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => remove(p.id)}>
                    {busy ? "Removing…" : "Remove"}
                  </button>
                </>
              ) : (
                <button className="btn btn-danger-quiet btn-sm" disabled={busy} aria-label={`Remove ${p.name}`} onClick={() => setRemoving(p.id)}>
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div>
        <button className="btn btn-primary btn-sm" disabled={busy || list.loading} onClick={add}>
          <KeyRound size={14} /> {busy && !removing ? "Waiting for your passkey…" : "Add a passkey"}
        </button>
      </div>
    </div>
  );
}
