import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { MeldlingArt } from "../components/MeldlingArt";
import { AlarmClock, Check, MessageSquare, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate } from "../../application/router";
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
  useLocaleRender();
  const engine = useEngine();
  const prefs = useOrbit((s) => s.nav[PERSONAL]);
  const supported = useOrbit((s) => s.server?.features.includes("saved-items") ?? false);
  const [showDone, setShowDone] = useState(false);
  const open = savedOpen(prefs);
  const done = savedDone(prefs);
  if (!supported)
    return (
      <p className="faint">
        <Localized k="workspace.interface.this_meldiq_server_doesn_t_keep_saved_messages_yet_bd4799e" />
      </p>
    );
  if (open.length === 0 && done.length === 0)
    return (
      <div className="empty">
        <MeldlingArt pose="love" />
        <h2>
          <Localized k="workspace.interface.nothing_saved_e620849" />
        </h2>
        <p>
          <Localized k="workspace.interface.save_a_message_for_later_from_its_menu_save_for_later_it_shows_up_bc76302" />
        </p>
      </div>
    );
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {open.map((i) => (
        <SavedRow key={i.messageId} item={i} />
      ))}
      {done.length > 0 && (
        <button className="btn btn-ghost btn-sm" style={{ justifySelf: "start" }} onClick={() => setShowDone((v) => !v)}>
          {showDone ? uiText("workspace.interface.hide_done_fd8ce20") : uiText("workspace.interface.done_value0_71ccf3a", { value0: done.length })}
        </button>
      )}
      {showDone && done.map((i) => <SavedRow key={i.messageId} item={i} />)}
      <p className="faint" style={{ fontSize: 12, margin: 0 }}>
        {engine.state.get().reminders.available
          ? uiText("workspace.interface.reminders_on_saved_messages_go_off_on_all_your_devices_even_with_18652e8")
          : uiText("workspace.interface.reminders_on_saved_messages_show_while_meldiq_is_open_on_a_device_9da64ef")}
      </p>
    </div>
  );
}
function SavedRow({ item }: { item: SavedItem }) {
  useLocaleRender();
  const l10n = useLocalization();
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
  const where = conversation && me ? conversationTitle(conversation, me.userId, users) : uiText("workspace.interface.a_conversation_you_re_no_longer_in_13d5503");
  const sender = message ? (message.outgoing ? uiText("workspace.nav_you") : (users[message.senderUserId]?.displayName ?? uiText("messaging.react_someone"))) : null;
  const overdue = item.remindAt !== null && item.remindAt <= Date.now() && !item.done;
  return (
    <div className={`card later-row${item.done ? " done" : ""}`}>
      <button className="later-open" disabled={!conversation} onClick={() => navigate({ section: conversation?.type === "DM" ? "dms" : "home", conversationId: item.conversationId })}>
        <MessageSquare size={16} className="faint" />
        <span className="lines grow">
          <small className="ellipsis">
            {conversation?.type === "CHANNEL" ? uiText("messaging.interface.value0_dbac6f0", { value0: where }) : where}
            {sender ? uiText("calls.interface.value0_9402340", { value0: sender }) : ""}
          </small>
          <span className="later-text">
            {message === undefined ? "…" : message ? preview(message) || l10n("messaging.message") : uiText("workspace.interface.open_the_conversation_to_see_this_message_3a90a91")}
          </span>
        </span>
      </button>
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        {item.remindAt !== null && !item.done && (
          <span className={`tag${overdue ? " warn" : ""}`}>{overdue ? uiText("workspace.interface.due_value0_9ee6d02", { value0: whenLabel(item.remindAt) }) : whenLabel(item.remindAt)}</span>
        )}
        <span className="grow" />
        {!item.done && (
          <button className="btn btn-ghost btn-sm" onClick={() => setReminding(true)}>
            <AlarmClock size={14} /> {item.remindAt !== null ? uiText("workspace.interface.change_c0bf75b") : uiText("workspace.interface.remind_me_4e679ad")}
          </button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={() => void engine.later({ op: "savedDone", messageId: item.messageId, done: !item.done })}>
          {item.done ? <RotateCcw size={14} /> : <Check size={14} />} {item.done ? uiText("workspace.interface.not_done_0df2acb") : l10n("common.actions.done")}
        </button>
        <button className="btn btn-ghost btn-sm" aria-label={l10n("messaging.msg_remove_later")} onClick={() => void engine.later({ op: "unsave", messageId: item.messageId })}>
          <Trash2 size={14} />
        </button>
      </div>
      {reminding && (
        <RemindMeDialog
          title={uiText("messaging.interface.remind_me_about_this_message_e8c7aaa")}
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
