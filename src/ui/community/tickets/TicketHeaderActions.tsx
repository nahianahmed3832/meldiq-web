import { CircleX, LogIn } from "lucide-react";
import { useState } from "react";
import type { Conversation } from "../../../api/schemas";
import { useEngine, useOrbit } from "../../../application/orbit";
import { joinTicket, openTickets, POSTING_FEATURES } from "../../../sync/posting/api";
import { looksLikeTicket, ticketError } from "../../../sync/posting/tickets";
import { useLoad } from "../../workspace/useLoad";
import { CloseTicketDialog } from "./TicketDialogs";

/**
 * A ticket channel's header buttons (the reference closes tickets from the channel header): Close for its opener and
 * moderators, and Join for a moderator who isn't in it yet. Only channels named like tickets are looked up, among the
 * open tickets this person can see (their own, or all of them for moderators).
 */
export function TicketHeaderActions({ c }: { c: Conversation }) {
  const engine = useEngine();
  const offered = useOrbit((s) => s.server?.features.includes(POSTING_FEATURES.tickets) ?? false);
  const orgId = offered && c.type === "CHANNEL" && c.orgId && !c.archived && looksLikeTicket(c.name) ? c.orgId : null;
  const [tick, setTick] = useState(0);
  const tickets = useLoad(() => (orgId ? openTickets(engine, orgId) : Promise.resolve([])), [engine, orgId, tick]);
  const [closing, setClosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const ticket = tickets.data?.find((t) => t.channelId === c.id) ?? null;
  if (!orgId || !ticket) return null;
  const join = async () => {
    setBusy(true);
    try {
      await joinTicket(engine, orgId, c.id);
      setTick((n) => n + 1);
    } catch (e) {
      engine.notice("error", ticketError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {!ticket.joined && (
        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void join()}>
          <LogIn size={15} /> Join
        </button>
      )}
      <button className="btn btn-secondary btn-sm ticket-close" onClick={() => setClosing(true)} title="Close this ticket">
        <CircleX size={15} /> Close
      </button>
      {closing && (
        <CloseTicketDialog
          orgId={orgId}
          channelId={c.id}
          onClose={() => {
            setClosing(false);
            setTick((n) => n + 1);
          }}
        />
      )}
    </>
  );
}
