import { countLabel } from "../../i18n/counts";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { PinOff, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import type { StoredMessage } from "../../model/types";
import { shortWhen } from "../format";
import { jumpTo } from "./jump";
import { CollectionControls, useMessageCollection } from "./useMessageCollection";
/** Cached pins for optional badges on older servers; the panels themselves use authoritative collection pages. */
export function usePinned(conversationId: string): StoredMessage[] {
  const engine = useEngine();
  const loaded = useOrbit((s) => s.messages[conversationId]);
  const [pinned, setPinned] = useState<StoredMessage[]>([]);
  useEffect(() => {
    let alive = true;
    engine
      .pinnedMessages(conversationId)
      .then((list) => alive && setPinned(list))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [engine, conversationId, loaded]);
  return pinned;
}
/**
 * Pinned messages (android round 7 PinnedMessagesSheet), newest first. Choosing one shows it in the conversation,
 * loading older messages if needed; people who may post here can unpin it for everyone.
 */
export function PinnedPanel({ conversationId, onClose }: { conversationId: string; onClose: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const collection = useMessageCollection(conversationId, "pins");
  const pinned = (collection.page?.messages ?? [])
    .filter((m) => !m.deleted && m.pinned)
    .slice()
    .reverse();
  const users = useOrbit((s) => s.users);
  const canPost = useOrbit((s) => s.conversations[conversationId]?.canPost ?? false);
  const [missing, setMissing] = useState(false);
  return (
    <aside className="panel" aria-label={l10n("messaging.conv_pins")}>
      <div className="panel-head">
        <div className="grow" style={{ minWidth: 0 }}>
          <h2>
            <Localized k="messaging.interface.pinned_f20c879" />
          </h2>
          <small>
            <Localized k="messaging.interface.native_count_5b1ba916a" slots={[countLabel(pinned.length, "messages"), ""]} />
          </small>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label={uiText("messaging.interface.close_panel_a600b90")}>
          <X size={18} />
        </button>
      </div>
      <div className="panel-body scroll">
        <CollectionControls collection={collection} />
        {missing && (
          <p className="banner warn" role="status">
            <Localized k="messaging.interface.that_message_isn_t_loaded_in_this_conversation_any_more_d58914f" />
          </p>
        )}
        {collection.page && pinned.length === 0 ? (
          <p className="faint" style={{ padding: "8px 4px" }}>
            <Localized k="messaging.interface.nothing_is_pinned_here_pin_a_message_from_its_menu_so_everyone_in_c22dc50" />
          </p>
        ) : (
          <ul className="search-results">
            {pinned.map((m) => (
              <li key={m.id} className="pinned-row">
                <button
                  className="list-row"
                  onClick={() => {
                    setMissing(false);
                    void jumpTo(engine, conversationId, m.id).then((ok) => setMissing(!ok));
                  }}
                >
                  <span className="lines">
                    <small>
                      {m.outgoing ? l10n("workspace.nav_you") : (users[m.senderUserId]?.displayName ?? l10n("messaging.react_someone"))} · {shortWhen(m.sortTs)}
                    </small>
                    <span className="clamp-2">{m.text || (m.attachments.length ? uiText("messaging.interface.attachment_040d2b3") : l10n("messaging.message"))}</span>
                  </span>
                </button>
                {canPost && (
                  <button
                    className="icon-btn"
                    onClick={() => void engine.setPinned(m, false)}
                    aria-label={l10n("messaging.msg_unpin")}
                    title={uiText("messaging.interface.unpin_for_everyone_fb2fcac")}
                  >
                    <PinOff size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
