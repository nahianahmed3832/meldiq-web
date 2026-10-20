import type { ContactCard, SharedLocation } from "../protocol/payload";
import type { RichContent } from "../model/types";
import { pollFallback } from "./polls";
import { findSticker, stickerFallback } from "./stickers";

/**
 * Contact cards and locations sent from the browser (docs/RICH_MESSAGES.md; android RichRules). They travel inside the
 * encrypted message, with a readable text for apps that don't show them.
 */
const MAX_NAME = 100;
const MAX_FIELDS = 5;
const MAX_FIELD = 64;
const MAX_LABEL = 120;

const coord = (v: number): string => v.toFixed(6);

const USER_ID = /^[A-Za-z0-9_-]{1,64}$/;
/** Local usernames, or federated ones with their server (name@server.example), as android RichRules.USERNAME. */
const USERNAME = /^[A-Za-z0-9_.-]{1,64}(@[A-Za-z0-9.-]{1,190})?$/;

/**
 * A contact as the phone cleans it (android RichRules.clean): trimmed, bounded, de-duplicated, at least a name. A
 * profile card (with a valid user id) is only a profile: whatever numbers or addresses a sender put in are dropped.
 * Null when nothing usable.
 */
export function cleanContact(c: ContactCard): ContactCard | null {
  const name = c.name.trim().slice(0, MAX_NAME);
  if (!name) return null;
  const userId = c.userId?.trim();
  if (userId && USER_ID.test(userId)) {
    const username = c.username?.trim();
    return { name, phones: [], emails: [], userId, ...(username && USERNAME.test(username) ? { username } : {}) };
  }
  const list = (l: string[]) => [...new Set(l.map((x) => x.trim().slice(0, MAX_FIELD)).filter(Boolean))].slice(0, MAX_FIELDS);
  return { name, phones: list(c.phones), emails: list(c.emails) };
}

/** The Meldiq profile card for a person (android RichRules.profileCard): name, user id and username only. */
export function profileCard(userId: string, displayName: string, username: string | null): ContactCard | null {
  return cleanContact({ name: displayName.trim() || (username ?? ""), phones: [], emails: [], userId, ...(username ? { username } : {}) });
}

/** A card as it goes on the wire: a profile card without the empty legacy lists, as the phone sends it. */
export function contactWire(c: ContactCard): ContactCard {
  if (!c.userId) return c;
  const { phones: _p, emails: _e, ...profile } = c;
  return profile as ContactCard;
}

export function cleanLocation(l: SharedLocation): SharedLocation | null {
  if (!Number.isFinite(l.lat) || !Number.isFinite(l.lon) || Math.abs(l.lat) > 90 || Math.abs(l.lon) > 180) return null;
  const acc = l.accuracyM !== undefined && Number.isFinite(l.accuracyM) && l.accuracyM >= 0 && l.accuracyM < 100_000 ? l.accuracyM : undefined;
  const label = l.label?.trim().slice(0, MAX_LABEL) || undefined;
  return { lat: l.lat, lon: l.lon, ...(acc !== undefined ? { accuracyM: acc } : {}), ...(label ? { label } : {}) };
}

/** A map link anyone can open (android RichRules.osmLink). */
export function osmLink(l: SharedLocation): string {
  return `https://www.openstreetmap.org/?mlat=${coord(l.lat)}&mlon=${coord(l.lon)}#map=16/${coord(l.lat)}/${coord(l.lon)}`;
}

/** The text older apps and notifications show (android RichRules.fallbackText). */
export function fallbackText(r: RichContent): string {
  if (r.contact?.userId) return `👤 ${r.contact.name}${r.contact.username ? ` (@${r.contact.username})` : ""}`;
  if (r.contact) return `👤 ${[r.contact.name, ...r.contact.phones, ...r.contact.emails].join("\n")}`;
  if (r.location) return `📍 ${r.location.label ? `${r.location.label}\n` : ""}${osmLink(r.location)}`;
  if (r.poll) return pollFallback(r.poll);
  if (r.sticker) {
    const spec = findSticker(r.sticker);
    return spec ? stickerFallback(spec) : "Sticker";
  }
  return r.animoji ?? "";
}

/** "23.81033, 90.41252 · within 12 m". */
export function describeLocation(l: SharedLocation): string {
  return `${l.lat.toFixed(5)}, ${l.lon.toFixed(5)}${l.accuracyM !== undefined ? ` · within ${Math.trunc(l.accuracyM)} m` : ""}`;
}

/** One position from the browser, asked for at the moment the person shares it (no watching, no map tiles). */
export function currentPosition(timeoutMs = 15_000): Promise<SharedLocation> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("This browser can't share a location."));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, accuracyM: p.coords.accuracy }),
      (e) =>
        reject(
          new Error(
            e.code === e.PERMISSION_DENIED
              ? "Meldiq isn't allowed to use your location. Allow it in your browser's site settings and try again."
              : e.code === e.TIMEOUT
                ? "Your location took too long to find. Try again."
                : "Your location couldn't be found.",
          ),
        ),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}
