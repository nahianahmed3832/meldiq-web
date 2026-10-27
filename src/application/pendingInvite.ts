/**
 * An invitation opened from a link (community-first brief §F): /join/<code> (from meldiq.app/invite/<code>'s "Use Meldiq
 * Web") or ?invite=<code>. The code is kept for this tab until someone is signed in, so signing in or setting the browser up
 * first doesn't lose it, then the shell opens Join with it (and its preview) once.
 */
const KEY = "meldiq.pendingInvite";
/** Invitation codes: letters, digits and dashes (ABCD-EFGH-JKLM); anything else is ignored. */
const CODE = /^[A-Za-z0-9-]{4,40}$/;

export function inviteFromLocation(pathname: string, search: string): string | null {
  const fromPath = /^\/join\/([^/]+)\/?$/.exec(pathname)?.[1];
  const raw = fromPath ? safeDecode(fromPath) : new URLSearchParams(search).get("invite");
  return raw && CODE.test(raw) ? raw.toUpperCase() : null;
}

/** At start: keeps a link's invitation for this tab and moves the address to Home (once read, the code leaves the URL). */
export function capturePendingInvite(): void {
  const code = inviteFromLocation(location.pathname, location.search);
  if (!code) return;
  try {
    sessionStorage.setItem(KEY, code);
  } catch {
    /* no storage: the code still opens below if already signed in */
    pending = code;
  }
  history.replaceState(history.state, "", "/home");
}

let pending: string | null = null;

/** The kept invitation, once (null if none). */
export function takePendingInvite(): string | null {
  let code = pending;
  pending = null;
  try {
    code = sessionStorage.getItem(KEY) ?? code;
    sessionStorage.removeItem(KEY);
  } catch {
    /* in memory only */
  }
  return code && CODE.test(code) ? code : null;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return "";
  }
}

/**
 * A message link opened in a fresh tab (/m/<conversation>/<message>): kept for this tab like an invitation, then opened
 * at that message once someone is signed in (the conversation must be theirs; ids only, never content).
 */
const MESSAGE_KEY = "meldiq.pendingMessage";
const MESSAGE_PATH = /^\/m\/([A-Za-z0-9_-]{1,128})\/([A-Za-z0-9_-]{1,128})\/?$/;

export function capturePendingMessage(): void {
  const m = MESSAGE_PATH.exec(location.pathname);
  if (!m) return;
  const path = `/m/${m[1]}/${m[2]}`;
  try {
    sessionStorage.setItem(MESSAGE_KEY, path);
  } catch {
    pendingMessage = path;
  }
  history.replaceState(history.state, "", "/home");
}

let pendingMessage: string | null = null;

/** The kept message link's path (/m/C/M), once (null if none). */
export function takePendingMessage(): string | null {
  let path = pendingMessage;
  pendingMessage = null;
  try {
    path = sessionStorage.getItem(MESSAGE_KEY) ?? path;
    sessionStorage.removeItem(MESSAGE_KEY);
  } catch {
    /* in memory only */
  }
  return path && MESSAGE_PATH.test(path) ? path : null;
}
