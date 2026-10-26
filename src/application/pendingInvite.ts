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
