import type { GiveawayState } from "../model/types";

/**
 * The Giveaways bot's card (community parity D part 2; docs/COMMUNITY_PARITY_API.md › Official bots): the payload's
 * `giveaway` field, cleaned like the boxes beside it. Anything malformed is dropped, never the message.
 */

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_WINNERS = 50;

/** The payload's `giveaway`, or null when it isn't a usable one. */
export function cleanGiveaway(v: unknown): GiveawayState | null {
  if (!v || typeof v !== "object") return null;
  const g = v as Record<string, unknown>;
  if (typeof g.id !== "string" || !ID.test(g.id)) return null;
  if (typeof g.endsAt !== "number" || !Number.isFinite(g.endsAt) || g.endsAt <= 0) return null;
  const winners = typeof g.winners === "number" && Number.isInteger(g.winners) && g.winners > 0 ? Math.min(g.winners, MAX_WINNERS) : 1;
  const ids = Array.isArray(g.winnerIds) ? g.winnerIds.filter((x): x is string => typeof x === "string" && ID.test(x)).slice(0, MAX_WINNERS) : [];
  return { id: g.id, endsAt: g.endsAt, winners, ended: g.ended === true, winnerIds: [...new Set(ids)] };
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "2d 3h", "4h 12m", "12m 5s", "8s": how long until [endsAt] (or "any moment" once it passed but isn't ended yet). */
export function countdown(endsAt: number, now: number): string {
  const left = endsAt - now;
  if (left <= 0) return "any moment";
  const d = Math.floor(left / DAY);
  const h = Math.floor((left % DAY) / HOUR);
  const m = Math.floor((left % HOUR) / MINUTE);
  const s = Math.floor((left % MINUTE) / SECOND);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

/** How often the countdown redraws: every second in its last hour, else every minute. */
export function countdownStep(endsAt: number, now: number): number {
  return endsAt - now <= HOUR ? SECOND : MINUTE;
}
