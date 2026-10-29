import { useState } from "react";
import { useEngine } from "../../../application/orbit";
import { navigate } from "../../../application/router";
import { joinTicket, openTickets } from "../../../sync/posting/api";
import { ticketError } from "../../../sync/posting/tickets";
import { relative } from "../../format";
import { useLoad } from "../../workspace/useLoad";
import { Card, ErrorLine } from "../../workspace/WorkspaceView";
import { CloseTicketDialog } from "./TicketDialogs";

/** Moderators' list of open tickets: who opened each, what about, and Open, Join or Close. */
export function OpenTicketsList({ orgId }: { orgId: string }) {
  const engine = useEngine();
  const [tick, setTick] = useState(0);
  const list = useLoad(() => openTickets(engine, orgId), [engine, orgId, tick]);
  const [closing, setClosing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const join = async (channelId: string) => {
    setBusy(true);
    setError(null);
    try {
      await joinTicket(engine, orgId, channelId);
      navigate({ section: "home", conversationId: channelId });
    } catch (e) {
      setError(ticketError(e));
    } finally {
      setBusy(false);
    }
  };
  const tickets = list.data ?? [];
  return (
    <Card title="Open tickets" sub="Every open ticket in this community. Moderators who weren't one yet when a ticket opened can join it.">
      <ErrorLine text={error ?? list.error} />
      {list.data && tickets.length === 0 && <small className="faint">No open tickets.</small>}
      {tickets.length > 0 && (
        <ul className="ws-list" aria-label="Open tickets">
          {tickets.map((t) => (
            <li key={t.channelId} className="ws-row">
              <span className="lines grow">
                <span className="ellipsis">
                  #{t.name}
                  {t.panelName ? ` · ${t.panelName}` : ""}
                </span>
                <small className="ellipsis">
                  {t.opener ? `${t.opener.displayName} (@${t.opener.username})` : "Someone who left"} · {relative(t.openedAt)} · {t.about}
                </small>
              </span>
              {t.joined ? (
                <button className="btn btn-secondary btn-sm" onClick={() => navigate({ section: "home", conversationId: t.channelId })}>
                  Open
                </button>
              ) : (
                <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void join(t.channelId)}>
                  Join
                </button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => setClosing(t.channelId)}>
                Close
              </button>
            </li>
          ))}
        </ul>
      )}
      {closing && (
        <CloseTicketDialog
          orgId={orgId}
          channelId={closing}
          onClose={() => {
            setClosing(null);
            setTick((n) => n + 1);
          }}
        />
      )}
    </Card>
  );
}
