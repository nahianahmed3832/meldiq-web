import { AlarmClock, Check, MessageSquare, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useEngine, useOrbit } from "../../app/orbit";
import { navigate } from "../../app/router";
import type { StoredMessage } from "../../model/types";
import { PERSONAL, type SavedItem, savedDone, savedOpen } from "../../sync/navPrefs";
import { preview } from "../../sync/rules";
import { conversationTitle } from "../format";
import { RemindMeDialog } from "./RemindMeDialog";
import { whenLabel } from "./when";

/**
 * Saved for later (android Home › Later): the messages the person saved, synced across their devices (ids and times
 * only; each message is read from this browser's encrypted copy). Open ones first, then done.
 */
export function SavedList() {
  const engine = useEngine();
  const prefs = useOrbit((s) => s.nav[PERSONAL]);
  const supported = useOrbit((s) => s.server?.features.includes("saved-items") ?? false);
  const [showDone, setShowDone] = useState(false);
  const open = savedOpen(prefs);
  const done = savedDone(prefs);
  if (!supported) return <p className="faint">This Meldiq server doesn't keep saved messages yet.</p>;
  if (open.length === 0 && done.length === 0)
    return (
      <div className="empty">
        <span className="empty-orb">
          <AlarmClock size={24} />
        </span>
        <h2>Nothing saved</h2>
        <p>Save a message for later from its menu (⋯ › Save for later). It shows up here on all your devices, with a reminder if you want one.</p>
      </div>
    );
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {open.map((i) => (
        <SavedRow key={i.messageId} item={i} />
      ))}
      {done.length > 0 && (
        <button className="btn btn-ghost btn-sm" style={{ justifySelf: "start" }} onClick={() => setShowDone((v) => !v)}>
          {showDone ? "Hide done" : `Done (${done.length})`}
        </button>
      )}
      {showDone && done.map((i) => <SavedRow key={i.messageId} item={i} />)}
      <p className="faint" style={{ fontSize: 12, margin: 0 }}>
        {engine.state.get().reminders.available
          ? "Reminders on saved messages go off on all your devices, even with Meldiq closed."
          : "Reminders on saved messages show while Meldiq is open on a device."}
      </p>
    </div>
  );
}

function SavedRow({ item }: { item: SavedItem }) {
  const engine = useEngine();
  const conversation = useOrbit((s) => s.conversations[item.conversationId]);
  const me = useOrbit((s) => s.me);
  const users = useOrbit((s) => s.users);
  const [message, setMessage] = useState<StoredMessage | null | undefined>(undefined);
  const [reminding, setReminding] = useState(false);
  useEffect(() => {
    let alive = true;
    engine.store
      .message(item.messageId)
      .then((m) => alive && setMessage(m))
      .catch(() => alive && setMessage(null));
    return () => {
      alive = false;
    };
  }, [engine, item.messageId]);
  const where = conversation && me ? conversationTitle(conversation, me.userId, users) : "A conversation you're no longer in";
  const sender = message ? (message.outgoing ? "You" : (users[message.senderUserId]?.displayName ?? "Someone")) : null;
  const overdue = item.remindAt !== null && item.remindAt <= Date.now() && !item.done;
  return (
    <div className={`card later-row${item.done ? " done" : ""}`}>
      <button className="later-open" disabled={!conversation} onClick={() => navigate({ section: conversation?.type === "DM" ? "dms" : "home", conversationId: item.conversationId })}>
        <MessageSquare size={16} className="faint" />
        <span className="lines grow">
          <small className="ellipsis">
            {conversation?.type === "CHANNEL" ? `#${where}` : where}
            {sender ? ` · ${sender}` : ""}
          </small>
          <span className="later-text">{message === undefined ? "…" : message ? preview(message) || "Message" : "This message isn't on this browser (it may be older than its history here)."}</span>
        </span>
      </button>
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        {item.remindAt !== null && !item.done && <span className={`tag${overdue ? " warn" : ""}`}>{overdue ? `Due ${whenLabel(item.remindAt)}` : whenLabel(item.remindAt)}</span>}
        <span className="grow" />
        {!item.done && (
          <button className="btn btn-ghost btn-sm" onClick={() => setReminding(true)}>
            <AlarmClock size={14} /> {item.remindAt !== null ? "Change" : "Remind me"}
          </button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={() => void engine.later({ op: "savedDone", messageId: item.messageId, done: !item.done })}>
          {item.done ? <RotateCcw size={14} /> : <Check size={14} />} {item.done ? "Not done" : "Done"}
        </button>
        <button className="btn btn-ghost btn-sm" aria-label="Remove from Later" onClick={() => void engine.later({ op: "unsave", messageId: item.messageId })}>
          <Trash2 size={14} />
        </button>
      </div>
      {reminding && (
        <RemindMeDialog
          title="Remind me about this message"
          current={item.remindAt}
          onPick={(at) => {
            setReminding(false);
            void engine.later({ op: "remind", messageId: item.messageId, remindAt: at });
          }}
          onClear={() => {
            setReminding(false);
            void engine.later({ op: "remind", messageId: item.messageId, remindAt: null });
          }}
          onClose={() => setReminding(false)}
        />
      )}
    </div>
  );
}
