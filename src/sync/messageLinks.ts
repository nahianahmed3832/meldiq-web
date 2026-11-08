/**
 * Web message links use decimal IDs. The /m/ and meldiq:// forms remain valid for existing links and native clients.
 */
import { meldiqPath, webOrigin } from "./webOrigin";
import { DECIMAL_LINK_ID, LEGACY_LINK_ID, decodeLinkId, encodeLinkId } from "../application/linkIds";

const APP = new RegExp(`^meldiq://m/(${LEGACY_LINK_ID})/(${LEGACY_LINK_ID})/?$`, "i");
const LEGACY = new RegExp(`^/m/(${LEGACY_LINK_ID})/(${LEGACY_LINK_ID})/?$`);
const PATH = new RegExp(`^/messages/(${DECIMAL_LINK_ID})/(${DECIMAL_LINK_ID})/?$`);

/** On the address this app is served from, so it opens in any browser (see webOrigin.ts). */
export const messageLink = (conversationId: string, messageId: string): string => `${webOrigin()}/messages/${encodeLinkId(conversationId)}/${encodeLinkId(messageId)}`;

export function parseMessagePath(path: string): { conversationId: string; messageId: string } | null {
  const legacy = LEGACY.exec(path);
  if (legacy) return { conversationId: legacy[1], messageId: legacy[2] };
  const match = PATH.exec(path);
  if (!match) return null;
  const conversationId = decodeLinkId(match[1]);
  const messageId = decodeLinkId(match[2]);
  return conversationId && messageId ? { conversationId, messageId } : null;
}

/** The conversation and message a link points to (any Meldiq host, or meldiq://), or null when [url] isn't one. */
export function parseMessageLink(url: string): { conversationId: string; messageId: string } | null {
  // Only the bare link: anything after it (a query, a fragment) means it isn't one of ours.
  const m = APP.exec(url.trim());
  return m ? { conversationId: m[1], messageId: m[2] } : /[?#]/.test(url) ? null : parseMessagePath(meldiqPath(url) ?? "");
}

/** Only messages the server has (sent, not pending or failed) and that still exist get a link. */
export const canLink = (deleted: boolean, status: string): boolean => !deleted && status !== "SENDING" && status !== "FAILED" && status !== "HELD";
