import { useLocaleRender } from "../../../i18n/Localized";
import { text as uiText } from "../../../i18n";
import { Localized } from "../../../i18n/Localized";
import { useT as useLocalization } from "../../../i18n";
import { useState } from "react";
import { useEngine, useOrbit } from "../../../application/orbit";
import { navigate } from "../../../application/router";
import { assignTicket, closedTickets, joinTicket, openTickets, POSTING_FEATURES, type Ticket } from "../../../sync/posting/api";
import { ticketError } from "../../../sync/posting/tickets";
import { relative } from "../../format";
import { useLoad } from "../../workspace/useLoad";
import { Card, ErrorLine } from "../../components/SettingsCard";
import { CloseTicketDialog, ReopenTicketDialog } from "./TicketDialogs";

export function OpenTicketsList({ orgId }: { orgId: string }) {
  const viewerId = useOrbit((s) => s.me?.userId ?? null);
  const lifecycle = useOrbit((s) => s.server?.features.includes(POSTING_FEATURES.ticketLifecycle) ?? false);
  const role = useOrbit((s) => s.orgs.find((o) => o.id === orgId)?.myRole ?? null);
  if (!viewerId) return null;
  return <TicketDesk key={JSON.stringify([orgId, viewerId, lifecycle])} orgId={orgId} viewerId={viewerId} lifecycle={lifecycle} admin={role === "OWNER" || role === "ADMIN"} />;
}

function TicketDesk({ orgId, viewerId, lifecycle, admin }: { orgId: string; viewerId: string; lifecycle: boolean; admin: boolean }) {
  useLocaleRender();
  const l10n = useLocalization();
  const [closed, setClosed] = useState(false);
  return (
    <Card
      title={l10n(lifecycle ? "organization.interface.tickets_3d13136" : "organization.interface.open_tickets_f8f5bc2")}
      sub={closed ? undefined : uiText("organization.interface.every_open_ticket_in_this_community_moderators_who_weren_t_one_ye_25ae886")}
    >
      {lifecycle && (
        <div className="row">
          <button type="button" className="btn btn-secondary btn-sm" aria-pressed={!closed} onClick={() => setClosed(false)}>
            {l10n("organization.interface.open_tickets_f8f5bc2")}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" aria-pressed={closed} onClick={() => setClosed(true)}>
            {l10n("organization.tickets_lifecycle.closed")}
          </button>
        </div>
      )}
      <TicketRows key={closed ? "closed" : "open"} orgId={orgId} viewerId={viewerId} lifecycle={lifecycle} admin={admin} closed={closed} />
    </Card>
  );
}

function TicketRows({ orgId, viewerId, lifecycle, admin, closed }: { orgId: string; viewerId: string; lifecycle: boolean; admin: boolean; closed: boolean }) {
  const l10n = useLocalization();
  const engine = useEngine();
  const list = useLoad(() => (closed ? closedTickets(engine, orgId) : openTickets(engine, orgId)), [engine, orgId, closed]);
  const [closing, setClosing] = useState<string | null>(null);
  const [reopening, setReopening] = useState<{ channelId: string; revision: number } | null>(null);
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
  const assign = async (ticket: Ticket) => {
    if (ticket.revision === undefined) return;
    setBusy(true);
    setError(null);
    try {
      await assignTicket(engine, orgId, ticket.channelId, ticket.claimedBy ? ticket.revision : undefined);
    } catch (e) {
      setError(ticketError(e));
    } finally {
      list.reload();
      setBusy(false);
    }
  };
  const tickets = list.error ? [] : (list.data ?? []);
  return (
    <>
      <ErrorLine text={error ?? list.error} />
      {list.data && !list.error && tickets.length === 0 && (
        <small className="faint">
          <Localized k={closed ? "organization.tickets_lifecycle.none_closed" : "organization.interface.no_open_tickets_4df2aa3"} />
        </small>
      )}
      {tickets.length > 0 && (
        <ul className="ws-list" aria-label={l10n(closed ? "organization.tickets_lifecycle.closed" : "organization.interface.open_tickets_f8f5bc2")}>
          {tickets.map((t) => (
            <li key={t.channelId} className="ws-row">
              <span className="lines grow">
                <span className="ellipsis">
                  #{t.name}
                  {t.panelName ? uiText("calls.interface.value0_9402340", { value0: t.panelName }) : ""}
                </span>
                <small className="ellipsis">
                  {t.opener
                    ? uiText("organization.interface.value0_value1_fa6dfa2", { value0: t.opener.displayName, value1: t.opener.username })
                    : uiText("organization.interface.someone_who_left_9d5f4f0")}{" "}
                  · {relative(t.openedAt)} · {t.about}
                </small>
                {t.claimedBy && <small className="ellipsis">{l10n("organization.tickets_lifecycle.assigned", { name: t.claimedBy.displayName })}</small>}
              </span>
              {closed ? (
                t.revision !== undefined && (
                  <button className="btn btn-secondary btn-sm" disabled={list.loading} onClick={() => setReopening({ channelId: t.channelId, revision: t.revision! })}>
                    {l10n("organization.tickets_lifecycle.reopen")}
                  </button>
                )
              ) : (
                <>
                  {t.joined ? (
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate({ section: "home", conversationId: t.channelId })}>
                      {l10n("workspace.discover_open_btn")}
                    </button>
                  ) : (
                    <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void join(t.channelId)}>
                      {l10n("workspace.discover_join")}
                    </button>
                  )}
                  {lifecycle && t.revision !== undefined && (!t.claimedBy || t.claimedBy.id === viewerId || admin) && (
                    <button className="btn btn-secondary btn-sm" disabled={busy || list.loading} onClick={() => void assign(t)}>
                      {l10n(t.claimedBy ? "organization.tickets_lifecycle.release" : "organization.tickets_lifecycle.claim")}
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => setClosing(t.channelId)}>
                    {l10n("common.actions.close")}
                  </button>
                </>
              )}
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
            list.reload();
          }}
        />
      )}
      {reopening && (
        <ReopenTicketDialog
          orgId={orgId}
          review={reopening}
          onClose={() => {
            setReopening(null);
            list.reload();
          }}
        />
      )}
    </>
  );
}
