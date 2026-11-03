import { formatUiNumber } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { useState } from "react";
import type { ProfilePin } from "../../api/profileSchemas";
import { pinImage } from "../../sync/pins";
/** Pins shown before "+N" (the rest open with it). */
const SHOWN = 8;
const what = (p: ProfilePin): string => [p.name, p.description, p.community ? `From ${p.community.name}` : "Meldiq"].filter(Boolean).join(" · ");
/**
 * A profile's pins (API 0.64.0, server docs/PROFILE_PINS.md), a row of small badges under the name like the reference's:
 * Meldiq's for milestones, then the ones communities gave. Hovering one names it; clicking one says what it's for.
 */
export function ProfilePins({ pins }: { pins: ProfilePin[] }) {
  useLocaleRender();
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  if (pins.length === 0) return null;
  const shown = all ? pins : pins.slice(0, SHOWN);
  const picked = pins.find((p) => p.id === open) ?? null;
  return (
    <div className="profile-pins-wrap">
      <ul className="profile-pins" aria-label={uiText("files.interface.pins_64baafa")}>
        {shown.map((p) => (
          <li key={p.id}>
            <button type="button" className="profile-pin" aria-pressed={open === p.id} title={what(p)} aria-label={what(p)} onClick={() => setOpen((o) => (o === p.id ? null : p.id))}>
              <img src={pinImage(p.id)} alt="" width={22} height={22} loading="lazy" decoding="async" draggable={false} />
            </button>
          </li>
        ))}
        {!all && pins.length > SHOWN && (
          <li>
            <button type="button" className="profile-pin more" onClick={() => setAll(true)} aria-label={uiText("files.interface.show_value0_more_pins_b6f2e17", { value0: pins.length - SHOWN })}>
              +{formatUiNumber(pins.length - SHOWN)}
            </button>
          </li>
        )}
      </ul>
      {picked && (
        <div className="profile-pin-card" role="status">
          <img src={pinImage(picked.id)} alt="" width={40} height={40} />
          <span className="grow">
            <strong>{picked.name}</strong>
            {picked.description && <small>{picked.description}</small>}
            <small className="faint">{picked.community ? uiText("files.interface.given_by_value0_4eb53a1", { value0: picked.community.name }) : uiText("files.interface.a_meldiq_pin_1c85cdb")}</small>
          </span>
        </div>
      )}
    </div>
  );
}
