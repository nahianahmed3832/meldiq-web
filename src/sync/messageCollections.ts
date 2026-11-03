import { text as uiText } from "../i18n";
import type { CollectionCursor } from "../api/messageCollections";
import type { StoredMessage } from "../model/types";
import { threadTitle, type ThreadRow } from "./threads";
export interface MessageCollectionPage {
  messages: StoredMessage[];
  context: StoredMessage[];
  threads: {
    rootId: string;
    replyCount: number;
    lastReplyTs: number;
  }[];
  more: boolean;
  nextCursor: CollectionCursor | null;
}
/** Counts come from the shared API, including replies outside the browser's cached history. */
export function collectionThreads(page: MessageCollectionPage): ThreadRow[] {
  const roots = new Map(page.messages.map((m) => [m.id, m]));
  return page.threads.map((t) => {
    const root = roots.get(t.rootId);
    return {
      rootId: t.rootId,
      title: root?.deleted
        ? uiText("messaging.interface.deleted_message_0a8438e")
        : root
          ? threadTitle(root.rich?.title, root.text, root.attachments[0]?.name ?? uiText("messaging.interface.attachment_040d2b3"))
          : uiText("messaging.interface.earlier_thread_157be1a"),
      senderId: root?.senderUserId ?? "",
      outgoing: root?.outgoing ?? false,
      replies: t.replyCount,
      lastReplyTs: t.lastReplyTs,
    };
  });
}
