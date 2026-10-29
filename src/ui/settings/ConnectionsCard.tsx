import { Link2, Unlink } from "lucide-react";
import { useEffect, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import {
  type ConnectionEntry,
  type ConnectionReturn,
  connectionReturn,
  connectionReturnText,
  connections,
  disconnect,
  type Provider,
  PROVIDER_LABEL,
  PROVIDER_SHOWS,
  setConnectionVisible,
  startConnection,
} from "../../sync/linkedAccounts";
import { Toggle } from "../components/Toggle";
import { useAction, useLoad } from "../workspace/useLoad";

/**
 * Settings › My Profile › Connections (API 0.65.0 batch B): Steam, AniList, Last.fm and Trakt. Connecting sends the
 * browser to the provider's own sign-in page, which brings it back here with ?connected= or ?connectionError=; that's
 * said once and taken off the address.
 */
export function ConnectionsCard() {
  const engine = useEngine();
  const offered = useOrbit((s) => s.server?.features.includes("connections-v2") ?? false);
  const [version, setVersion] = useState(0);
  const list = useLoad(() => (offered ? connections(engine) : Promise.resolve(null)), [engine, offered, version]);
  const [back, setBack] = useState<ConnectionReturn | null>(null);
  const act = useAction();

  // Once, when the page opens from a provider's way back: keep the notice, clean the address (no reload).
  useEffect(() => {
    const r = connectionReturn(location.search);
    if (!r) return;
    setBack(r);
    history.replaceState(history.state, "", location.pathname);
  }, []);

  if (!offered) return null;
  const run = (fn: () => Promise<unknown>) => void act.act(fn).then((ok) => ok && setVersion((v) => v + 1));
  const connect = (p: Provider) =>
    void act.act(async () => {
      window.location.assign(await startConnection(engine, p));
    });

  return (
    <div className="card" style={{ padding: 20, display: "grid", gap: 14 }} aria-label="Connections">
      <div className="lines">
        <h2 style={{ margin: 0, fontSize: 17 }}>Connections</h2>
        <small className="faint">Show what you play, watch and listen to. You sign in on their own page; Meldiq never sees your password.</small>
      </div>
      {back && (
        <div className={`banner ${back.kind === "connected" ? "ok" : "danger"}`} role="status">
          <span className="grow">{connectionReturnText(back)}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setBack(null)}>
            OK
          </button>
        </div>
      )}
      {(list.error || act.error) && (
        <div className="banner danger" role="alert">
          {act.error ?? list.error}
        </div>
      )}
      {!list.data && !list.error && <div className="skeleton" style={{ height: 120 }} aria-busy="true" />}
      <ul className="ws-list connection-list">
        {(list.data ?? []).map((c) => (c.provider === "unknown" ? null : <ConnectionRow key={c.provider} c={c} provider={c.provider} busy={act.busy} onConnect={connect} onRun={run} />))}
      </ul>
    </div>
  );
}

interface RowProps {
  c: ConnectionEntry;
  provider: Provider;
  busy: boolean;
  onConnect: (p: Provider) => void;
  onRun: (fn: () => Promise<unknown>) => void;
}

function ConnectionRow({ c, provider, busy, onConnect, onRun }: RowProps) {
  const engine = useEngine();
  const label = PROVIDER_LABEL[provider];
  return (
    <li className={`ws-row connection-row${c.available ? "" : " off"}`}>
      <span className={`connection-mark cm-${provider}`} aria-hidden="true">
        {label.slice(0, 1)}
      </span>
      <span className="lines grow">
        <span>
          {label}
          {c.connected && c.account ? <span className="faint"> · {c.account.name}</span> : null}
        </span>
        <small>{!c.available ? "Not set up on this server yet." : PROVIDER_SHOWS[provider]}</small>
      </span>
      {c.connected ? (
        <>
          <Toggle label={`Show ${label} on your profile`} checked={c.visible} disabled={busy} onChange={(v) => onRun(() => setConnectionVisible(engine, provider, v))} />
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onRun(() => disconnect(engine, provider))}>
            <Unlink size={14} /> Disconnect
          </button>
        </>
      ) : (
        <button className="btn btn-secondary btn-sm" disabled={busy || !c.available} onClick={() => onConnect(provider)}>
          <Link2 size={14} /> Connect
        </button>
      )}
    </li>
  );
}
