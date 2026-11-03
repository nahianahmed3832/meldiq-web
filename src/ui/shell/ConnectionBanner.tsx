import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { RefreshCw, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
/** A dropped connection usually comes back within a moment: the banner waits this long before showing. */
const SHOW_AFTER_MS = 1500;
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
/**
 * The connection to the Meldiq server, only while it's down (brief v4 §16, as the Android app's ConnectionBanner): a
 * slim notice over the top of the screen with Retry. While connected nothing shows; your own avatar's dot says you're
 * online. It replaces the "Online" pill that sat in the top bar.
 */
export function ConnectionBanner() {
  useLocaleRender();
  const engine = useEngine();
  const connection = useOrbit((s) => s.connection);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (connection === "online") {
      setShown(false);
      return;
    }
    const t = setTimeout(() => setShown(true), SHOW_AFTER_MS);
    return () => clearTimeout(t);
  }, [connection]);
  if (!shown || connection === "online") return null;
  return (
    <div className={`conn-banner ${connection}`} role="status">
      <WifiOff size={15} aria-hidden="true" />
      <span className="grow">{connection === "offline" ? uiText("workspace.interface.you_re_offline_messages_you_send_go_out_when_you_re_back_e6cdfc4") : CONN_LABEL[connection]}</span>
      <button type="button" className="conn-retry" onClick={() => engine.reconnect()}>
        <Localized k="workspace.interface.retry_b0cd914" slots={[<RefreshCw size={13} aria-hidden="true" />]} />
      </button>
    </div>
  );
}
