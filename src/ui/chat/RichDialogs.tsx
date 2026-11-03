import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
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
  useLocaleRender();
  const l10n = useLocalization();
  const [loc, setLoc] = useState<SharedLocation | null>(null);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const find = () => {
    setError(null);
    setLoc(null);
    currentPosition()
      .then(setLoc)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : uiText("messaging.interface.your_location_couldn_t_be_found_94ab6b1")));
  };
  useEffect(find, []);
  const ready = loc ? cleanLocation({ ...loc, label: label || undefined }) : null;
  return (
    <Dialog title={uiText("messaging.interface.share_your_location_6575502")} onClose={onClose}>
      <div className="dialog-body">
        {error ? (
          <div className="banner danger" role="alert">
            <span className="grow">{error}</span>
            <button className="btn btn-secondary btn-sm" onClick={find}>
              {l10n("common.actions.retry")}
            </button>
          </div>
        ) : !loc ? (
          <p className="muted" style={{ margin: 0 }} aria-live="polite">
            <Localized k="messaging.interface.finding_your_location_992f1d9" />
          </p>
        ) : (
          <div className="card" style={{ padding: 14, display: "flex", gap: 10, alignItems: "center" }}>
            <MapPin size={18} />
            <span className="mono">{describeLocation(loc)}</span>
          </div>
        )}
        <label className="field">
          <span>
            <Localized k="messaging.interface.place_name_optional_3c8b8c9" />
          </span>
          <input className="input" value={label} maxLength={120} onChange={(e) => setLabel(e.target.value)} placeholder={uiText("messaging.interface.e_g_office_3rd_floor_5a65b6f")} />
        </label>
        <p className="faint" style={{ margin: 0, fontSize: 12.5 }}>
          <Localized k="messaging.interface.sent_once_people_open_it_in_their_own_map_app_b4e655c" />
        </p>
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>
            {l10n("common.actions.cancel")}
          </button>
          <button className="btn btn-primary" disabled={!ready} onClick={() => ready && onSend(ready)}>
            <Localized k="messaging.interface.send_location_f901234" slots={[<MapPin size={16} />]} />
          </button>
        </div>
      </div>
    </Dialog>
  );
}
