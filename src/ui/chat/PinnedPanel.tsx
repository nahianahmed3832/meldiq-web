import { Pin, PinOff, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useEngine, useOrbit } from "../../app/orbit";
import { navigate, useRoute } from "../../app/router";
import type { StoredMessage } from "../../model/types";
import { shortWhen } from "../format";
import { jumpTo } from "./jump";

/** This conversation's pinned messages on this browser, kept current as pins arrive (they're encrypted control messages). */
function usePinned(conversationId: string): StoredMessage[] {
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

/** The pin button in the conversation header (android round 7 PinnedButton), with how many are pinned. */
export function PinnedButton({ conversationId }: { conversationId: string }) {
  const route = useRoute();
  const count = usePinned(conversationId).length;
  const open = route.panel === "pinned";
  return (
    <button
      className="icon-btn pin-btn"
      aria-pressed={open}
      onClick={() => navigate({ section: route.section, conversationId, panel: open ? null : "pinned" })}
      aria-label={count ? `Pinned messages (${count})` : "Pinned messages"}
      title="Pinned messages"
    >
      <Pin size={17} />
      {count > 0 && <span className="pin-count">{count}</span>}
    </button>
  );
}

/**
 * Pinned messages (android round 7 PinnedMessagesSheet), newest first. Choosing one shows it in the conversation,
 * loading older messages if needed; people who may post here can unpin it for everyone.
 */
export function PinnedPanel({ conversationId, onClose }: { conversationId: string; onClose: () => void }) {
  const engine = useEngine();
  const pinned = usePinned(conversationId);
  const users = useOrbit((s) => s.users);
  const canPost = useOrbit((s) => s.conversations[conversationId]?.canPost ?? false);
  const [missing, setMissing] = useState(false);
  return (
    <aside className="panel" aria-label="Pinned messages">
      <div className="panel-head">
        <div className="grow" style={{ minWidth: 0 }}>
          <h2>Pinned</h2>
          <small>{pinned.length === 1 ? "1 message" : `${pinned.length} messages`}</small>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close panel">
          <X size={18} />
        </button>
      </div>
      <div className="panel-body scroll">
        {missing && (
          <p className="banner warn" role="status">
            That message isn't loaded in this conversation any more.
          </p>
        )}
        {pinned.length === 0 ? (
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
