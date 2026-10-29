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
    <Dialog title="Open a ticket" onClose={onClose}>
      <form className="dialog-body" onSubmit={(e) => void submit(e)} noValidate>
        <div className="banner warn" role="note">
          <TriangleAlert size={16} aria-hidden />
          <span className="grow">
            Tickets go to this community's moderators, not to Meldiq. They aren't for bug reports, feedback or suggestions.{" "}
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                onClose();
                navigate({ section: "settings", settingsPage: "account" });
              }}
            >
              Report a bug or get verified instead
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
            <label htmlFor="tk-panel">Kind of ticket</label>
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
          <label htmlFor="tk-about">What is it about?</label>
          <textarea id="tk-about" className="textarea" rows={4} data-autofocus value={about} maxLength={TICKET_ABOUT_MAX} onChange={(e) => setAbout(e.target.value)} />
          <span className="hint">
            {[...about].length}/{TICKET_ABOUT_MAX}
          </span>
        </div>
        <label className="check-row">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          <span>This isn't a bug report, feedback or a suggestion</span>
        </label>
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy || !about.trim() || !confirmed}>
            {busy ? "Opening…" : "Open ticket"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** Close a ticket (its opener or a moderator): the channel is archived and the close logged. */
export function CloseTicketDialog({ orgId, channelId, onClose }: { orgId: string; channelId: string; onClose: () => void }) {
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
      setError(err instanceof ApiError ? err.message : "Couldn't close the ticket. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      title="Close this ticket?"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-danger" data-autofocus disabled={busy} onClick={() => void close()}>
            {busy ? "Closing…" : "Close ticket"}
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
          The channel is archived: everyone in it can still read it, nobody can post. Opening another ticket starts a new channel.
        </p>
      </div>
    </Dialog>
  );
}
