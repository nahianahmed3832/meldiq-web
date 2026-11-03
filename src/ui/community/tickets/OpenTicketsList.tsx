import { useLocaleRender } from "../../../i18n/Localized";
import { text as uiText } from "../../../i18n";
import { Localized } from "../../../i18n/Localized";
import { useT as useLocalization } from "../../../i18n";
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
  useLocaleRender();
  const l10n = useLocalization();
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
    <Card title={uiText("organization.interface.open_tickets_f8f5bc2")} sub={uiText("organization.interface.every_open_ticket_in_this_community_moderators_who_weren_t_one_ye_25ae886")}>
      <ErrorLine text={error ?? list.error} />
      {list.data && tickets.length === 0 && (
        <small className="faint">
          <Localized k="organization.interface.no_open_tickets_4df2aa3" />
        </small>
      )}
      {tickets.length > 0 && (
        <ul className="ws-list" aria-label={uiText("organization.interface.open_tickets_f8f5bc2")}>
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
              </span>
              {t.joined ? (
                <button className="btn btn-secondary btn-sm" onClick={() => navigate({ section: "home", conversationId: t.channelId })}>
                  {l10n("workspace.discover_open_btn")}
                </button>
              ) : (
                <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void join(t.channelId)}>
                  {l10n("workspace.discover_join")}
                </button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => setClosing(t.channelId)}>
                {l10n("common.actions.close")}
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
