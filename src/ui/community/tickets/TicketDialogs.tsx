import { formatUiNumber } from "../../../i18n/format";
import { useLocaleRender } from "../../../i18n/Localized";
import { text as uiText } from "../../../i18n";
import { Localized } from "../../../i18n/Localized";
import { useT as useLocalization } from "../../../i18n";
import { TriangleAlert } from "lucide-react";
import { type FormEvent, useState } from "react";
import { ApiError } from "../../../api/client";
import { useEngine, useOrbit } from "../../../application/orbit";
import { navigate } from "../../../application/router";
import { closeTicket, openTicket } from "../../../sync/posting/api";
import { TICKET_ABOUT_MAX, ticketError } from "../../../sync/posting/tickets";
import { Dialog } from "../../components/Overlay";
/**
 * Open a Ticket (the community menu, or a panel's button): a private channel with the community's moderators about
 * something that isn't a bug report, feedback or a suggestion. The opener says what it's about and ticks that it isn't.
 */
export function OpenTicketDialog({ orgId, panelId, onClose }: { orgId: string; panelId: string | null; onClose: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const panels = useOrbit((s) => s.orgs.find((o) => o.id === orgId)?.tickets?.panels ?? []);
  const [panel, setPanel] = useState<string | null>(panelId ?? panels[0]?.id ?? null);
  const [about, setAbout] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!about.trim() || !confirmed) return;
    setBusy(true);
    setError(null);
    try {
      const ticket = await openTicket(engine, orgId, { panelId: panel, about: about.trim(), notABugReport: true });
      onClose();
      navigate({ section: "home", conversationId: ticket.channelId });
    } catch (err) {
      setError(ticketError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title={uiText("organization.interface.open_a_ticket_0f3ee46")} onClose={onClose}>
      <form className="dialog-body" onSubmit={(e) => void submit(e)} noValidate>
        <div className="banner warn" role="note">
          <TriangleAlert size={16} aria-hidden />
          <span className="grow">
            <Localized k="organization.interface.tickets_go_to_this_community_s_moderators_not_to_meldiq_they_aren_25058af" />
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                onClose();
                navigate({ section: "settings", settingsPage: "account" });
              }}
            >
              <Localized k="organization.interface.report_a_bug_or_get_verified_instead_e651d41" />
            </button>
          </span>
        </div>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        {!panelId && panels.length > 1 && (
          <div className="field">
            <label htmlFor="tk-panel">
              <Localized k="organization.interface.kind_of_ticket_b3acb05" />
            </label>
            <select id="tk-panel" className="input" value={panel ?? ""} onChange={(e) => setPanel(e.target.value || null)}>
              {panels.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="tk-about">
            <Localized k="organization.interface.what_is_it_about_4cbf3cc" />
          </label>
          <textarea id="tk-about" className="textarea" rows={4} data-autofocus value={about} maxLength={TICKET_ABOUT_MAX} onChange={(e) => setAbout(e.target.value)} />
          <span className="hint">
            {formatUiNumber([...about].length)}/{formatUiNumber(TICKET_ABOUT_MAX)}
          </span>
        </div>
        <label className="check-row">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          <span>
            <Localized k="organization.interface.this_isn_t_a_bug_report_feedback_or_a_suggestion_49b8658" />
          </span>
        </label>
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {l10n("common.actions.cancel")}
          </button>
          <button className="btn btn-primary" disabled={busy || !about.trim() || !confirmed}>
            {busy ? uiText("organization.interface.opening_c926c2c") : uiText("organization.interface.open_ticket_d7e0398")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
/** Close a ticket (its opener or a moderator): the channel is archived and the close logged. */
export function CloseTicketDialog({ orgId, channelId, onClose }: { orgId: string; channelId: string; onClose: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = async () => {
    setBusy(true);
    setError(null);
    try {
      await closeTicket(engine, orgId, channelId);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : uiText("organization.interface.couldn_t_close_the_ticket_try_again_95b54d9"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      title={uiText("organization.interface.close_this_ticket_53d0e6d")}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            {l10n("common.actions.cancel")}
          </button>
          <button className="btn btn-danger" data-autofocus disabled={busy} onClick={() => void close()}>
            {busy ? uiText("messaging.interface.closing_abdb0cf") : uiText("organization.interface.close_ticket_b5c3156")}
          </button>
        </>
      }
    >
      <div className="dialog-body">
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <p className="muted" style={{ margin: 0 }}>
          <Localized k="organization.interface.the_channel_is_archived_everyone_in_it_can_still_read_it_nobody_c_469209e" />
        </p>
      </div>
    </Dialog>
  );
}
