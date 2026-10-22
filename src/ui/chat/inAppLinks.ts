import { navigate } from "../../application/router";
import type { Engine } from "../../sync/engine";
import { inviteFromScan } from "../../sync/inviteCodes";
import { parseMessageLink } from "../../sync/messageLinks";
import { jumpTo } from "./jump";

/** Asks the shell to open Join with this invitation code (an invite link clicked inside a chat, batch B4b). */
export const JOIN_INVITE_EVENT = "meldiq:join-invite";

/**
 * Meldiq's own links clicked in a message open here instead of a new tab (android MessageLinkOpener, InviteScan):
 * a message link opens the conversation at that message, an invite link opens Join. True when the link was handled.
 */
export function openInApp(engine: Engine, href: string): boolean {
  const target = parseMessageLink(href);
  if (target) {
    const c = engine.state.get().conversations[target.conversationId];
    if (!c) {
      engine.notice("info", "You can't open this message: you're not in that conversation.");
      return true;
    }
    navigate({ section: c.type === "CHANNEL" ? "home" : "dms", conversationId: c.id });
    // The list mounts after navigation; then the message is found (older pages load if needed) and highlighted.
    setTimeout(() => {
      void jumpTo(engine, c.id, target.messageId).then((found) => {
        if (!found) engine.notice("info", "That message isn't on this browser, so the conversation opened without it.");
      });
    }, 150);
    return true;
  }
  if (/^https:\/\/(www\.)?meldiq\.app\/invite\//i.test(href.trim()) || /^(meldiq|griip):\/\/invite\//i.test(href.trim())) {
    const code = inviteFromScan(href);
    if (code) {
      window.dispatchEvent(new CustomEvent(JOIN_INVITE_EVENT, { detail: code }));
      return true;
    }
  }
  return false;
}
