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
    <aside className="panel" aria-label="Pinned messages">
      <div className="panel-head">
        <div className="grow" style={{ minWidth: 0 }}>
          <h2>Pinned</h2>
          <small>
            {pinned.length} {pinned.length === 1 ? "message" : "messages"} on this page
          </small>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close panel">
          <X size={18} />
        </button>
      </div>
      <div className="panel-body scroll">
        <CollectionControls collection={collection} />
        {missing && (
          <p className="banner warn" role="status">
            That message isn't loaded in this conversation any more.
          </p>
        )}
        {collection.page && pinned.length === 0 ? (
          <p className="faint" style={{ padding: "8px 4px" }}>
            Nothing is pinned here. Pin a message from its menu so everyone in the conversation can find it.
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
                      {m.outgoing ? "You" : (users[m.senderUserId]?.displayName ?? "Someone")} · {shortWhen(m.sortTs)}
                    </small>
                    <span className="clamp-2">{m.text || (m.attachments.length ? "Attachment" : "Message")}</span>
                  </span>
                </button>
                {canPost && (
                  <button className="icon-btn" onClick={() => void engine.setPinned(m, false)} aria-label="Unpin" title="Unpin for everyone">
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
