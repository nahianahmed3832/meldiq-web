import type { AppState } from "../state/store";
import { isArchived, isMuted, isPeople, isRequest, unreadOf } from "../ui/selectors";

/**
 * The tab's own unread signal (community-first brief §D): the title and the favicon.
 *
 * - The number is what's addressed to you: unread messages in direct messages and groups (not muted, archived or waiting
 *   as a request) plus mentions of you in channels.
 * - Other channel activity (not muted) shows as a dot: "• Meldiq" and a white dot on the icon, without a number.
 * - Where the favicon can't be redrawn, the title still carries both.
 */
export interface TabSignal {
  count: number;
  activity: boolean;
}

export function tabSignal(s: AppState): TabSignal {
  let count = 0;
  let activity = false;
  for (const c of Object.values(s.conversations)) {
    const unread = unreadOf(s, c.id);
    if (isPeople(c)) {
      if (unread > 0 && !isMuted(s, c) && !isArchived(s, c.id) && !isRequest(c)) count += unread;
      continue;
    }
    count += s.local[c.id]?.mentions ?? 0;
    if (unread > 0 && !isMuted(s, c)) activity = true;
  }
  return { count, activity };
}

export const TAB_TITLE = "Meldiq";

export function tabTitle(signal: TabSignal, base = TAB_TITLE): string {
  if (signal.count > 0) return `(${signal.count > 99 ? "99+" : signal.count}) ${base}`;
  return signal.activity ? `• ${base}` : base;
}

/** The favicon badge's text: a number up to 9, then "9+"; a dot for activity alone; nothing otherwise. */
export function badgeText(signal: TabSignal): string | null {
  if (signal.count > 0) return signal.count > 9 ? "9+" : String(signal.count);
  return signal.activity ? "" : null;
}

const ICON_SIZE = 64;
const ICON_SRC = "/meldling-192.png";
let original: string | null = null;
let base: Promise<HTMLImageElement> | null = null;

/** Redraws the favicon with [text]'s badge (null: the plain icon). Best effort: any failure leaves the icon as it was. */
export async function paintFavicon(text: string | null): Promise<void> {
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"][sizes="32x32"]') ?? document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) return;
  original ??= link.href;
  if (text === null) {
    link.href = original;
    return;
  }
  try {
    base ??= new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = ICON_SRC;
    });
    const img = await base;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = ICON_SIZE;
    const g = canvas.getContext("2d");
    if (!g) return;
    g.drawImage(img, 0, 0, ICON_SIZE, ICON_SIZE);
    const r = text ? 19 : 12;
    const cx = ICON_SIZE - r;
    const cy = ICON_SIZE - r;
    g.beginPath();
    g.arc(cx, cy, r + 3, 0, Math.PI * 2);
    g.fillStyle = "#070b18";
    g.fill();
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fillStyle = text ? "#ff5fa8" : "#ffffff";
    g.fill();
    if (text) {
      g.fillStyle = "#2a0517";
      g.font = `800 ${text.length > 1 ? 22 : 28}px system-ui, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(text, cx, cy + 1);
    }
    link.href = canvas.toDataURL("image/png");
  } catch {
    link.href = original;
  }
}
