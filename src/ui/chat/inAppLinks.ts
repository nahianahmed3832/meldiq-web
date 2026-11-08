import { text as uiText } from "../../i18n";
import { appHref, go, navigate, parseRoute } from "../../application/router";
import type { Engine } from "../../sync/engine";
import { TEMPLATE_PATH } from "../../sync/discovery/rules";
import { inviteFromScan } from "../../sync/inviteCodes";
import { parseMessageLink } from "../../sync/messageLinks";
import { meldiqPath } from "../../sync/webOrigin";
import { jumpTo } from "./jump";
/** Asks the shell to open a template link's preview (community parity E). */
export const OPEN_TEMPLATE_EVENT = "meldiq:open-template";
/** Asks the shell to open Join with this invitation code (an invite link clicked inside a chat, batch B4b). */
export const JOIN_INVITE_EVENT = "meldiq:join-invite";
/**
 * Meldiq's own links clicked in a message open here instead of a new tab (android MessageLinkOpener, InviteScan):
 * a message link jumps to the message, a conversation link opens the conversation, and an invite link opens Join.
 */
export function openInApp(engine: Engine, href: string): boolean {
  const target = parseMessageLink(href);
  if (target) {
    const c = engine.state.get().conversations[target.conversationId];
    if (!c) {
      engine.notice("info", uiText("messaging.interface.you_can_t_open_this_message_you_re_not_in_that_conversation_f918804"));
      return true;
    }
    navigate({ section: c.type === "CHANNEL" ? "home" : "dms", communityId: c.orgId, conversationId: c.id });
    // The list mounts after navigation; then the message is found (older pages load if needed) and highlighted.
    setTimeout(() => {
      void jumpTo(engine, c.id, target.messageId).then((found) => {
        if (!found) engine.notice("info", uiText("messaging.interface.that_message_is_gone_so_the_conversation_opened_without_it_ab6d27f"));
      });
    }, 150);
    return true;
  }
  const template = TEMPLATE_PATH.exec(meldiqPath(href) ?? "")?.[1];
  if (template) {
    window.dispatchEvent(new CustomEvent(OPEN_TEMPLATE_EVENT, { detail: template.toUpperCase() }));
    return true;
  }
  if ((meldiqPath(href) ?? "").startsWith("/invite/") || /^(meldiq|griip):\/\/invite\//i.test(href.trim())) {
    const code = inviteFromScan(href);
    if (code) {
      window.dispatchEvent(new CustomEvent(JOIN_INVITE_EVENT, { detail: code }));
      return true;
    }
  }
  const path = appHref(href);
  if (path && parseRoute(path).conversationId) {
    go(path);
    return true;
  }
  return false;
}
