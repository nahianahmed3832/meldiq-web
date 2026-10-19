import { MapPin, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import type { ContactCard, SharedLocation } from "../../protocol/payload";
import { cleanContact, cleanLocation, currentPosition, describeLocation } from "../../sync/rich";
import { Dialog } from "../components/Overlay";

/**
 * Sharing a contact card. The browser has no address book to read (and Orbit never uploads one), so the card is typed in;
 * it travels inside the encrypted message (docs/RICH_MESSAGES.md).
 */
export function ContactDialog({ onSend, onClose }: { onSend: (c: ContactCard) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [phones, setPhones] = useState("");
  const [emails, setEmails] = useState("");
  const card = cleanContact({ name, phones: phones.split(/[\n,;]/), emails: emails.split(/[\n,;]/) });
  return (
    <Dialog title="Share a contact" onClose={onClose}>
      <form
        className="dialog-body"
        onSubmit={(e) => {
          e.preventDefault();
          if (card) onSend(card);
        }}
      >
        <label className="field">
          <span>Name</span>
          <input className="input" data-autofocus value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Phone numbers</span>
          <input className="input" value={phones} onChange={(e) => setPhones(e.target.value)} placeholder="Separate with commas" />
        </label>
        <label className="field">
          <span>Email addresses</span>
          <input className="input" value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="Separate with commas" />
        </label>
        <p className="faint" style={{ margin: 0, fontSize: 12.5 }}>
          Up to 5 of each. Sent end-to-end encrypted, with a text version for apps that don't show cards.
        </p>
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!card}>
            <UserRound size={16} /> Send contact
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * Sharing where you are, once (android Attach › Location): the browser's own position, asked for now, confirmed before
 * sending. No live tracking and no map tiles, so no map service learns where it is.
 */
export function LocationDialog({ onSend, onClose }: { onSend: (l: SharedLocation) => void; onClose: () => void }) {
  const [loc, setLoc] = useState<SharedLocation | null>(null);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const find = () => {
    setError(null);
    setLoc(null);
    currentPosition()
      .then(setLoc)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Your location couldn't be found."));
  };
  useEffect(find, []);
  const ready = loc ? cleanLocation({ ...loc, label: label || undefined }) : null;
  return (
    <Dialog title="Share your location" onClose={onClose}>
      <div className="dialog-body">
        {error ? (
          <div className="banner danger" role="alert">
            <span className="grow">{error}</span>
            <button className="btn btn-secondary btn-sm" onClick={find}>
              Try again
            </button>
          </div>
        ) : !loc ? (
          <p className="muted" style={{ margin: 0 }} aria-live="polite">
            Finding your location…
          </p>
        ) : (
          <div className="card" style={{ padding: 14, display: "flex", gap: 10, alignItems: "center" }}>
            <MapPin size={18} />
            <span className="mono">{describeLocation(loc)}</span>
          </div>
        )}
        <label className="field">
          <span>Place name (optional)</span>
          <input className="input" value={label} maxLength={120} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Office, 3rd floor" />
        </label>
        <p className="faint" style={{ margin: 0, fontSize: 12.5 }}>
          Sent once, end-to-end encrypted. People open it in their own map app.
        </p>
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!ready} onClick={() => ready && onSend(ready)}>
            <MapPin size={16} /> Send location
          </button>
        </div>
      </div>
    </Dialog>
  );
}
