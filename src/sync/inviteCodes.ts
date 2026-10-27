/**
 * Invitation codes (android InviteCodes): the link the invite screen draws as a QR code (`https://meldiq.app/invite/CODE`
 * since batch B4b; `meldiq://invite/CODE`, or `griip://invite/CODE` from before Meldiq), the shared invite text that
 * contains it, or a bare code. Anything else, other web links included, is refused, so pasted text can never make the
 * app open a URL.
 */
import { meldiqPath, webOrigin } from "./webOrigin";

const LINK = /(?:(?:meldiq|griip):\/\/invite\/|https:\/\/(?:www\.|web\.)?meldiq\.app\/invite\/|https:\/\/web\.griipbuddy\.cloud\/invite\/)([A-Za-z0-9-]{1,40})/i;
const BARE = /^[A-Za-z0-9]{4}(-?[A-Za-z0-9]{4}){2,4}$/;
/** A code inside longer text, e.g. the shared invite message; never part of a web address. */
const EMBEDDED = /(?<![A-Za-z0-9/.])[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}(?:-[A-Za-z0-9]{4}){0,2}(?![A-Za-z0-9/-])/g;
/** The characters the server draws codes from (server CODE_ALPHABET): no I, L, O, 0 or 1, which look alike. */
export const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * The link the invite screen draws and shares, on the address this app is served from (web.meldiq.app): the
 * invitation page there loads in any browser. (It used to be meldiq.app, which has no web server, so those links didn't
 * open; they're still recognised when pasted.)
 */
export const inviteLink = (code: string): string => `${webOrigin()}/invite/${code}`;

const group = (code: string): string => code.match(/.{1,4}/g)!.join("-");

/** The invite code in a scanned or pasted link or bare code, formatted XXXX-XXXX-XXXX; null if it isn't one. */
export function inviteFromScan(scanned: string): string | null {
  const text = scanned.trim();
  const own = /^\/invite\/([A-Za-z0-9-]{1,40})\/?$/.exec(meldiqPath(text) ?? "")?.[1];
  const raw = LINK.exec(text)?.[1] ?? own ?? (BARE.test(text) ? text : null);
  if (!raw) return null;
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return code.length >= 12 && code.length <= 20 ? group(code) : null;
}

/** The code in pasted or typed text: the link, a whole code, or exactly one dashed code inside a longer message. */
export function extractInvite(text: string): string | null {
  const direct = inviteFromScan(text);
  if (direct) return direct;
  const found = [...new Set([...text.matchAll(EMBEDDED)].map((m) => m[0].toUpperCase()))];
  return found.length === 1 ? inviteFromScan(found[0]) : null;
}

export type TypedInvite = { kind: "incomplete" } | { kind: "invalid"; reason: string } | { kind: "ok"; code: string };

/** What the code field holds, checked before anything is sent: characters outside the alphabet are reported, not guessed. */
export function checkInvite(input: string): TypedInvite {
  const chars = input.toUpperCase().replace(/[^\p{L}\p{N}]/gu, "");
  if (!chars) return { kind: "incomplete" };
  const wrong = [...new Set([...chars].filter((c) => !INVITE_ALPHABET.includes(c)))].sort();
  if (wrong.length) return { kind: "invalid", reason: `Invite codes never contain ${wrong.join(", ")}. Check the code with whoever sent it.` };
  if (chars.length < 12) return { kind: "incomplete" };
  if (chars.length > 20 || chars.length % 4 !== 0) return { kind: "invalid", reason: "That doesn't look like a whole invite code (XXXX-XXXX-XXXX)." };
  return { kind: "ok", code: group(chars) };
}
