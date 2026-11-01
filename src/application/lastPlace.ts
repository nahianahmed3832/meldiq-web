import { appHref } from "./router";
import { COMMUNITY_PLACES_KEY } from "./communityLanding";

/**
 * Where the person was (2026-10-29, the owner: "ours refreshes like a website"): the last conversation or section, kept
 * on this browser for the account that was there, so coming back to Meldiq (its address alone, or the installed app's
 * start) opens where they left off, as Discord and installed apps do. A reload keeps its address anyway. Only the path
 * is kept, never anything from the conversation.
 */
const KEY = "meldiq.lastPlace";

interface Place {
  u: string;
  p: string;
}

/** Remembers [path] as where [userId] is now. */
export function rememberPlace(userId: string, path: string): void {
  const href = appHref(path);
  if (!href) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ u: userId, p: href } satisfies Place));
  } catch {
    /* storage unavailable: a return opens Home, as before */
  }
}

/** Forgets it (signing out, a removed browser). */
export function forgetPlace(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(COMMUNITY_PLACES_KEY);
  } catch {
    /* nothing kept */
  }
}

/**
 * The path to open instead of [where] for [userId]: only when the app was opened at its bare address ("/", no query or
 * hash: links, invitations and notifications keep theirs), and only a place this account left, re-read as one of the
 * app's own routes.
 */
export function placeToRestore(userId: string, where: { pathname: string; search: string; hash: string }): string | null {
  if (where.pathname !== "/" || where.search || where.hash) return null;
  let kept: unknown;
  try {
    kept = JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
  if (!kept || typeof kept !== "object") return null;
  const { u, p } = kept as Partial<Place>;
  if (u !== userId || typeof p !== "string") return null;
  const href = appHref(p);
  return href && href !== "/" ? href : null;
}
