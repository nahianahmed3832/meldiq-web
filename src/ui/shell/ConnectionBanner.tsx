import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { RefreshCw, WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { Icon } from "../icons/Icon";
/** A dropped connection usually comes back within a moment: the banner waits this long before showing. */
const SHOW_AFTER_MS = 1500;
const RECOVERED_MS = 1800;
export const CONN_LABEL = {
  get online() {
    return uiText("workspace.online");
  },
  get connecting() {
    return uiText("calls.connecting");
  },
  get reconnecting() {
    return uiText("calls.reconnecting");
  },
  get offline() {
    return uiText("messaging.people_offline");
  },
} as const;
/** Briefly shows recovery and the history refresh after a visible connection interruption. */
export function ConnectionBanner() {
  useLocaleRender();
  const engine = useEngine();
  const connection = useOrbit((s) => s.connection);
  const sync = useOrbit((s) => s.reconnectSync);
  const [shown, setShown] = useState(false);
  const wasInterrupted = useRef(false);
  useEffect(() => {
    if (connection === "online") {
      if (!wasInterrupted.current || sync === "idle") {
        wasInterrupted.current = false;
        setShown(false);
        return;
      }
      if (sync === "done") {
        const t = setTimeout(() => {
          setShown(false);
          wasInterrupted.current = false;
        }, RECOVERED_MS);
        return () => clearTimeout(t);
      }
      return;
    }
    if (wasInterrupted.current) return;
    const t = setTimeout(() => {
      wasInterrupted.current = true;
      setShown(true);
    }, SHOW_AFTER_MS);
    return () => clearTimeout(t);
  }, [connection, sync]);
  if (!shown || (connection === "online" && sync === "idle")) return null;
  const online = connection === "online";
  const recovered = online && sync === "done";
  const syncing = online && sync === "syncing";
  return (
    <div className={`conn-banner ${recovered ? "recovered" : connection}`} role="status">
      {recovered ? <Icon name="status.online" size={16} /> : syncing ? <span className="spinner" aria-hidden="true" /> : <WifiOff size={15} aria-hidden="true" />}
      <span className="grow">
        {recovered
          ? uiText("messaging.reconnect_caught_up")
          : syncing
            ? uiText("messaging.reconnect_catching_up")
            : online
              ? uiText("messaging.reconnect_refresh_failed")
              : connection === "offline"
                ? uiText("workspace.interface.you_re_offline_messages_you_send_go_out_when_you_re_back_e6cdfc4")
                : CONN_LABEL[connection]}
      </span>
      {!recovered && !syncing && (
        <button type="button" className="conn-retry" onClick={() => engine.reconnect()}>
          <Localized k="workspace.interface.retry_b0cd914" slots={[<RefreshCw size={13} aria-hidden="true" />]} />
        </button>
      )}
    </div>
  );
}
