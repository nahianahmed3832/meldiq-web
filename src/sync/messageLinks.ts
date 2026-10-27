/**
 * Message links (batch B5, android MessageLinks): `https://meldiq.app/m/CONV/MSG` (also `meldiq://m/CONV/MSG`). Only ids,
 * never content: it opens where the person is in the conversation and has the message, and says so otherwise.
 */
import { meldiqPath, webOrigin } from "./webOrigin";

const ID = "[A-Za-z0-9_-]{1,128}";
const APP = new RegExp(`^meldiq://m/(${ID})/(${ID})/?$`, "i");
const PATH = new RegExp(`^/m/(${ID})/(${ID})/?$`);

/** On the address this app is served from, so it opens in any browser (see webOrigin.ts). */
export const messageLink = (conversationId: string, messageId: string): string => `${webOrigin()}/m/${conversationId}/${messageId}`;

/** The conversation and message a link points to (any Meldiq host, or meldiq://), or null when [url] isn't one. */
export function parseMessageLink(url: string): { conversationId: string; messageId: string } | null {
  // Only the bare link: anything after it (a query, a fragment) means it isn't one of ours.
  const m = APP.exec(url.trim()) ?? (/[?#]/.test(url) ? null : PATH.exec(meldiqPath(url) ?? ""));
  return m ? { conversationId: m[1], messageId: m[2] } : null;
}

/** Only messages the server has (sent, not pending or failed) and that still exist get a link. */
export const canLink = (deleted: boolean, status: string): boolean => !deleted && status !== "SENDING" && status !== "FAILED" && status !== "HELD";
