import type { Engine } from "../../sync/engine";

/** Jumping to a message in the open conversation, from search results and the pinned list. */
/** How many older pages a result may load to be shown in place. */
const MAX_PAGES = 30;

/** Asks the open message list to scroll to and highlight [messageId] (MessageList listens). */
export const JUMP_EVENT = "meldiq:jump-to-message";

/** Loads older pages until [messageId] is among the shown messages; false if it isn't in this browser's history. */
export async function reveal(engine: Engine, conversationId: string, messageId: string): Promise<boolean> {
  // Not loaded yet: the server sends the messages around it (API 0.57.0), instead of paging back to it.
  if (!engine.state.get().messages[conversationId]?.items.some((m) => m.id === messageId)) await engine.loadAround(conversationId, messageId).catch(() => undefined);
  for (let i = 0; i <= MAX_PAGES; i++) {
    const loaded = engine.state.get().messages[conversationId];
    if (loaded?.items.some((m) => m.id === messageId)) return true;
    if (loaded && !loaded.hasMore) return false;
    await engine.loadOlder(conversationId);
  }
  return false;
}

/** Scrolls the open conversation to [messageId], loading older messages first if needed; false if it isn't kept here. */
export async function jumpTo(engine: Engine, conversationId: string, messageId: string): Promise<boolean> {
  if (!(await reveal(engine, conversationId, messageId))) return false;
  window.dispatchEvent(new CustomEvent(JUMP_EVENT, { detail: messageId }));
  return true;
}
