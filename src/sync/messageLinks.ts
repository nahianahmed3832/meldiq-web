/**
 * Message links (batch B5, android MessageLinks): `https://meldiq.app/m/CONV/MSG` (also `meldiq://m/CONV/MSG`). Only ids,
 * never content: it opens where the person is in the conversation and has the message, and says so otherwise.
 */
const ID = "[A-Za-z0-9_-]{1,128}";
const LINK = new RegExp(`^(?:https://(?:www\\.)?meldiq\\.app/m/|meldiq://m/)(${ID})/(${ID})/?$`, "i");

export const messageLink = (conversationId: string, messageId: string): string => `https://meldiq.app/m/${conversationId}/${messageId}`;

/** The conversation and message a link points to, or null when [url] isn't a message link. */
export function parseMessageLink(url: string): { conversationId: string; messageId: string } | null {
  const m = LINK.exec(url.trim());
  return m ? { conversationId: m[1], messageId: m[2] } : null;
}

/** Only messages the server has (sent, not pending or failed) and that still exist get a link. */
export const canLink = (deleted: boolean, status: string): boolean => !deleted && status !== "SENDING" && status !== "FAILED" && status !== "HELD";
