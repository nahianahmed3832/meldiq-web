import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
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
  useLocaleRender();
  const l10n = useLocalization();
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
    <div className="card" style={{ padding: 20, display: "grid", gap: 14 }} aria-label={l10n("workspace.side_connections")}>
      <div className="lines">
        <h2 style={{ margin: 0, fontSize: 17 }}>{l10n("workspace.side_connections")}</h2>
        <small className="faint">
          <Localized k="settings.interface.show_what_you_play_watch_and_listen_to_you_sign_in_on_their_own_p_4ea380e" />
        </small>
      </div>
      {back && (
        <div className={`banner ${back.kind === "connected" ? "ok" : "danger"}`} role="status">
          <span className="grow">{connectionReturnText(back)}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setBack(null)}>
            <Localized k="settings.interface.ok_565339b" />
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
  useLocaleRender();
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
        <small>{!c.available ? uiText("settings.interface.not_set_up_on_this_server_yet_ed3e030") : PROVIDER_SHOWS[provider]}</small>
      </span>
      {c.connected ? (
        <>
          <Toggle
            label={uiText("settings.interface.show_value0_on_your_profile_906caa3", { value0: label })}
            checked={c.visible}
            disabled={busy}
            onChange={(v) => onRun(() => setConnectionVisible(engine, provider, v))}
          />
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onRun(() => disconnect(engine, provider))}>
            <Localized k="organization.interface.disconnect_b7715da" slots={[<Unlink size={14} />]} />
          </button>
        </>
      ) : (
        <button className="btn btn-secondary btn-sm" disabled={busy || !c.available} onClick={() => onConnect(provider)}>
          <Localized k="settings.interface.connect_80df039" slots={[<Link2 size={14} />]} />
        </button>
      )}
    </li>
  );
}
