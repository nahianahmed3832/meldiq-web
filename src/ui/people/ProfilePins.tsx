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
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  if (pins.length === 0) return null;
  const shown = all ? pins : pins.slice(0, SHOWN);
  const picked = pins.find((p) => p.id === open) ?? null;
  return (
    <div className="profile-pins-wrap">
      <ul className="profile-pins" aria-label="Pins">
        {shown.map((p) => (
          <li key={p.id}>
            <button type="button" className="profile-pin" aria-pressed={open === p.id} title={what(p)} aria-label={what(p)} onClick={() => setOpen((o) => (o === p.id ? null : p.id))}>
              <img src={pinImage(p.id)} alt="" width={22} height={22} loading="lazy" decoding="async" draggable={false} />
            </button>
          </li>
        ))}
        {!all && pins.length > SHOWN && (
          <li>
            <button type="button" className="profile-pin more" onClick={() => setAll(true)} aria-label={`Show ${pins.length - SHOWN} more pins`}>
              +{pins.length - SHOWN}
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
            <small className="faint">{picked.community ? `Given by ${picked.community.name}` : "A Meldiq pin"}</small>
          </span>
        </div>
      )}
    </div>
  );
}
