import type { StoredEvent } from "../api/schemas";
import type { StoredMessage } from "../model/types";

export const STARBOARD_UNAVAILABLE = "Original message unavailable.";

export function starboardProjection(e: StoredEvent): StoredMessage["starboard"] {
  if (e.senderDeviceId !== null || e.importedBy || e.payload.type !== "text" || e.cls !== "message") return undefined;
  const origin = e.payload.starboard;
  if (origin && typeof origin === "object" && "channelId" in origin && "messageId" in origin && typeof origin.channelId === "string" && typeof origin.messageId === "string") return "available";
  return e.payload.text === STARBOARD_UNAVAILABLE ? "unavailable" : undefined;
}

export function hideCachedStarboard(message: StoredMessage): StoredMessage {
  if (!message.starboard || message.deleted) return message;
  return {
    ...message,
    starboard: "unavailable",
    text: STARBOARD_UNAVAILABLE,
    attachments: [],
    rich: null,
    replyToId: null,
    threadRootId: null,
    mentions: [],
    mentionAll: false,
  };
}
