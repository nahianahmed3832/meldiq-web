import { UserCheck, UserPlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../api/client";
import { useEngine, useOrbit } from "../../application/orbit";
import { getPrefs } from "../../application/prefs";
import { systemNotify } from "../../application/webPush";
import { acceptConnection, type Connections, removeConnection } from "../../sync/social";
import { forgetConnections, newRequests, refreshConnections, rememberTold, toldUntil, useConnectionLists } from "./connectionRequests";

const lookedAt = (): boolean => document.visibilityState === "visible" && document.hasFocus();
const mayNotify = (): boolean => getPrefs().notifications && typeof Notification !== "undefined" && Notification.permission === "granted";

/**
 * Keeps this account's connection requests up to date (on start and on each `connections.updated` frame) and tells the
 * person about new ones: a notice on the page, and a system notification when the tab isn't being looked at.
 */
export function ConnectionRequestWatcher() {
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
        const who = fresh.length === 1 ? fresh[0].user.displayName : `${fresh.length} people`;
        const text = `${who} sent you a connection request. Accept it in DMs › Connection requests.`;
        engine.notice("info", text);
        if (mayNotify() && !lookedAt()) {
          const p = getPrefs();
          systemNotify({
            title: p.notificationText ? "Connection request" : "Meldiq",
            body: p.notificationText ? `${who} wants to connect with you` : "You have a new request",
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
  const engine = useEngine();
  const lists = useConnectionLists();
  const [busy, setBusy] = useState(false);
  if (!lists?.incoming.some((e) => e.user.id === userId)) return null;
  const answer = (fn: () => Promise<void>, done: string) => {
    setBusy(true);
    fn()
      .then(() => refreshConnections(engine))
      .then(() => engine.notice("info", done))
      .catch((e: unknown) => engine.notice("error", e instanceof ApiError ? e.message : "That didn't work. Try again."))
      .finally(() => setBusy(false));
  };
  return (
    <div className="banner info" role="status">
      <UserPlus size={16} aria-hidden />
      <span className="grow">{name} wants to connect with you.</span>
      <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => answer(() => acceptConnection(engine, userId), `You're connected with ${name}.`)}>
        <UserCheck size={14} /> Accept
      </button>
      <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => answer(() => removeConnection(engine, userId), "Request declined.")}>
        <X size={14} /> Decline
      </button>
    </div>
  );
}
