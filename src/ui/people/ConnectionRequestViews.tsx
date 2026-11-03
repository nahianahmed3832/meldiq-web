import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { UserCheck, UserPlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../api/client";
import { useEngine, useOrbit } from "../../application/orbit";
import { getPrefs } from "../../application/prefs";
import { systemNotify } from "../../application/webPush";
import { acceptConnection, type Connections, removeConnection } from "../../sync/social";
import { forgetConnections, newRequests, refreshConnections, rememberTold, toldUntil, useConnectionLists } from "./connectionRequests";
import { useT } from "../../i18n";
const lookedAt = (): boolean => document.visibilityState === "visible" && document.hasFocus();
const mayNotify = (): boolean => getPrefs().notifications && typeof Notification !== "undefined" && Notification.permission === "granted";
/**
 * Keeps this account's connection requests up to date (on start and on each `connections.updated` frame) and tells the
 * person about new ones: a notice on the page, and a system notification when the tab isn't being looked at.
 */
export function ConnectionRequestWatcher() {
  useLocaleRender();
  const engine = useEngine();
  const enabled = useOrbit((s) => s.synced && (s.server?.features.includes("connections") ?? false));
  const rev = useOrbit((s) => s.connectionsRev);
  const before = useRef<Connections["incoming"] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    refreshConnections(engine)
      .then((lists) => {
        if (!alive) return;
        const fresh = newRequests(before.current, lists.incoming, toldUntil());
        before.current = lists.incoming;
        if (!fresh.length) return;
        rememberTold(lists.incoming);
        const who = fresh.length === 1 ? fresh[0].user.displayName : uiText("workspace.interface.value0_people_0c377c0", { value0: fresh.length });
        const text = uiText("workspace.interface.value0_sent_you_a_connection_request_accept_it_in_dms_connection_7134a20", { value0: who });
        engine.notice("info", text);
        if (mayNotify() && !lookedAt()) {
          const p = getPrefs();
          systemNotify({
            title: p.notificationText ? uiText("workspace.interface.connection_request_cd97ea1") : "Meldiq",
            body: p.notificationText ? uiText("workspace.interface.value0_wants_to_connect_with_you_17488a1", { value0: who }) : uiText("workspace.interface.you_have_a_new_request_7373618"),
            tag: "connection-requests",
            href: "/dms",
            silent: !p.messageSound,
          });
        }
      })
      // Shown at the next frame or start; a failed check isn't worth an error notice.
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [engine, enabled, rev]);
  useEffect(() => () => forgetConnections(), []);
  return null;
}
/** In a DM with someone who asked to connect: their request, with Accept and Decline (the other person isn't told). */
export function ConnectionRequestBanner({ userId, name }: { userId: string; name: string }) {
  useLocaleRender();
  const engine = useEngine();
  const lists = useConnectionLists();
  const [busy, setBusy] = useState(false);
  const t = useT();
  if (!lists?.incoming.some((e) => e.user.id === userId)) return null;
  const answer = (fn: () => Promise<void>, done: string) => {
    setBusy(true);
    fn()
      .then(() => refreshConnections(engine))
      .then(() => engine.notice("info", done))
      .catch((e: unknown) => engine.notice("error", e instanceof ApiError ? e.message : uiText("workspace.interface.that_didn_t_work_try_again_5da2573")))
      .finally(() => setBusy(false));
  };
  return (
    <div className="banner info" role="status">
      <UserPlus size={16} aria-hidden />
      <span className="grow">{t("conn_wants", { name })}</span>
      <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => answer(() => acceptConnection(engine, userId), t("conn_connected", { name }))}>
        <UserCheck size={14} /> {t("conn_accept")}
      </button>
      <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => answer(() => removeConnection(engine, userId), t("conn_declined"))}>
        <X size={14} /> {t("conn_decline")}
      </button>
    </div>
  );
}
