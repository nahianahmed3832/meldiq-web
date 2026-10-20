import { MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import type { SharedLocation } from "../../protocol/payload";
import { cleanLocation, currentPosition, describeLocation } from "../../sync/rich";
import { Dialog } from "../components/Overlay";

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
