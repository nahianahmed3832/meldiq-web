import { useT } from "../../i18n";
import { formatDate } from "../../i18n/format";
import { getSavedCollections, updateSavedCollection, type CollectionOp, type SavedCollection } from "../../sync/savedCollections";
import { useAction, useLoad } from "../workspace/useLoad";
import { CollectionEditor } from "./CollectionControls";
import { Dialog } from "../components/Overlay";
import { openInApp } from "../chat/inAppLinks";
import { messageLink } from "../../sync/messageLinks";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { MeldlingArt } from "../components/MeldlingArt";
import { AlarmClock, Check, MessageSquare, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
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
  const t = useT();
  const engine = useEngine();
  const prefs = useOrbit((s) => s.nav[PERSONAL]);
  const supported = useOrbit((s) => s.server?.features.includes("saved-items") ?? false);
  const collectionsOn = useOrbit((s) => s.server?.features.includes("saved-collections") ?? false);
  const conversations = useOrbit((s) => s.conversations);
  const users = useOrbit((s) => s.users);
  const me = useOrbit((s) => s.me);
  const [filter, setFilter] = useState("open");
  const [query, setQuery] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [editor, setEditor] = useState<"new" | SavedCollection | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [limit, setLimit] = useState(20);
  const collections = useLoad(() => collectionsOn ? getSavedCollections(engine.api) : Promise.resolve([]), [engine, collectionsOn, prefs?.saved]);
  const act = useAction();
  const mutate = (op: CollectionOp) => act.act(async () => {
    await updateSavedCollection(engine.api, op);
    collections.reload();
  });
  const saved = prefs?.saved;
  const word = query.trim().toLocaleLowerCase();
  const previews = useLoad(async () => {
    if (!word) return new Set<string>();
    const found = await Promise.all((saved ?? []).filter((i) => !!conversations[i.conversationId]).map(async (i) => {
      const m = await engine.store.message(i.messageId);
      return m && !m.deleted && m.conversationId === i.conversationId && preview(m).toLocaleLowerCase().includes(word) ? i.messageId : null;
    }));
    return new Set(found);
  }, [engine, saved, conversations, word]);
  const collection = collections.data?.find((c) => c.id === collectionId);
  const ids = collection && new Set(collection.messageIds);
  const all = [...savedOpen(prefs), ...savedDone(prefs)];
  const visible = all.filter((i) => {
    if (ids && !ids.has(i.messageId)) return false;
    if ((filter === "open" && i.done) || (filter === "done" && !i.done)) return false;
    if (!word) return true;
    const c = conversations[i.conversationId];
    return !!(c && me && conversationTitle(c, me.userId, users).toLocaleLowerCase().includes(word)) || !!previews.data?.has(i.messageId);
  });
  if (!supported)
    return <p className="faint"><Localized k="workspace.interface.this_meldiq_server_doesn_t_keep_saved_messages_yet_bd4799e" /></p>;
  return (
    <div className="experience-panel" style={{ padding: 0 }}>
      <div className="experience-controls">
        <label>{t("workspace.experience.findSaved")}<input className="input input-sm" value={query} onChange={(e) => { setQuery(e.target.value); setLimit(20); }} maxLength={100} /></label>
        <label>{t("messaging.interface.show_0df6f1c")}
          <select className="input input-sm" value={filter} onChange={(e) => { setFilter(e.target.value); setLimit(20); }}>
            <option value="open">{t("workspace.experience.openSaved")}</option>
            <option value="done">{t("common.actions.done")}</option>
            <option value="all">{t("settings.ap_all")}</option>
          </select>
        </label>
        {collectionsOn && <>
          <label>{t("workspace.experience.collections")}
            <select className="input input-sm" value={collectionId} onChange={(e) => { setCollectionId(e.target.value); setLimit(20); }}>
              <option value="">{t("workspace.experience.allSaved")}</option>
              {(collections.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <button className="btn btn-secondary btn-sm" disabled={act.busy || !collections.data || collections.data.length >= 20} onClick={() => { act.clear(); setEditor("new"); }}>{t("workspace.experience.newCollection")}</button>
          {collection && <>
            <button className="btn btn-ghost btn-sm" disabled={act.busy} onClick={() => { act.clear(); setEditor(collection); }}>{t("workspace.experience.renameCollection")}</button>
            <button className="btn btn-danger-quiet btn-sm" disabled={act.busy} onClick={() => { act.clear(); setDeleting(true); }}>{t("workspace.experience.deleteCollection")}</button>
          </>}
        </>}
      </div>
      {!editor && !deleting && (collections.error || previews.error || act.error) && <div className="banner danger" role="alert">
        {collections.error ?? previews.error ?? act.error} <button className="btn btn-ghost btn-sm" onClick={() => { act.clear(); collections.reload(); previews.reload(); }}>{t("workspace.experience.retry")}</button>
      </div>}
      {((collectionsOn && collections.loading && !collections.data) || (word && previews.loading)) && <div className="experience-skeleton" role="status" aria-label={t("workspace.experience.loading")} />}
      {!(word && previews.loading) && visible.length === 0 && <div className="empty">
        <MeldlingArt pose="love" />
        <h2>{all.length ? t("workspace.experience.noSavedMatches") : uiText("workspace.interface.nothing_saved_e620849")}</h2>
        {!all.length && <p><Localized k="workspace.interface.save_a_message_for_later_from_its_menu_save_for_later_it_shows_up_bc76302" /></p>}
      </div>}
      {!(word && previews.loading) && visible.slice(0, limit).map((i) => (
        <SavedRow key={i.messageId} item={i} collections={collections.data ?? []} busy={act.busy} mutate={mutate} />
      ))}
      {visible.length > limit && <button className="btn btn-secondary btn-sm" onClick={() => setLimit(limit + 20)}>{t("workspace.discover_more")}</button>}
      {editor && <CollectionEditor collection={editor === "new" ? undefined : editor} busy={act.busy} error={act.error} save={mutate} close={() => setEditor(null)} />}
      {deleting && collection && <Dialog title={t("workspace.experience.deleteCollection")} onClose={() => setDeleting(false)} footer={
        <>
          <button className="btn btn-secondary" onClick={() => setDeleting(false)}>{t("common.actions.cancel")}</button>
          <button className="btn btn-danger" disabled={act.busy} onClick={() => void mutate({ op: "delete", id: collection.id }).then((ok) => {
            if (ok) { setCollectionId(""); setDeleting(false); }
          })}>{t("workspace.experience.deleteCollection")}</button>
        </>
      }><div className="dialog-body"><p>{t("workspace.experience.deleteCollectionHelp")}</p>{act.error && <p className="banner danger" role="alert">{act.error}</p>}</div></Dialog>}
      <p className="faint" style={{ fontSize: 12, margin: 0 }}>
        {engine.state.get().reminders.available
          ? uiText("workspace.interface.reminders_on_saved_messages_go_off_on_all_your_devices_even_with_18652e8")
          : uiText("workspace.interface.reminders_on_saved_messages_show_while_meldiq_is_open_on_a_device_9da64ef")}
      </p>
    </div>
  );
}
function SavedRow({ item, collections, busy, mutate }: { item: SavedItem; collections: SavedCollection[]; busy: boolean; mutate: (op: CollectionOp) => Promise<boolean> }) {
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
    if (!conversation) return;
    engine.store
      .message(item.messageId)
      .then((m) => alive && setMessage(m))
      .catch(() => alive && setMessage(null));
    return () => {
      alive = false;
    };
  }, [engine, item.messageId, conversation]);
  const where = conversation && me ? conversationTitle(conversation, me.userId, users) : uiText("workspace.interface.a_conversation_you_re_no_longer_in_13d5503");
  const accessible = conversation && message?.conversationId === item.conversationId ? message : null;
  const sender = accessible ? (accessible.outgoing ? uiText("workspace.nav_you") : (users[accessible.senderUserId]?.displayName ?? uiText("messaging.react_someone"))) : null;
  const overdue = item.remindAt !== null && item.remindAt <= Date.now() && !item.done;
  return (
    <div className={`card later-row${item.done ? " done" : ""}`}>
      <button className="later-open" disabled={!conversation} onClick={() => openInApp(engine, messageLink(item.conversationId, item.messageId))}>
        <MessageSquare size={16} className="faint" />
        <span className="lines grow">
          <small className="ellipsis">
            {conversation?.type === "CHANNEL" ? uiText("messaging.interface.value0_dbac6f0", { value0: where }) : where}
            {sender ? uiText("calls.interface.value0_9402340", { value0: sender }) : ""}
          </small>
          <span className="later-text">
            {conversation && message === undefined ? "…" : accessible && !accessible.deleted ? preview(accessible) || l10n("messaging.message") : uiText("workspace.interface.open_the_conversation_to_see_this_message_3a90a91")}
          </span>
          <small>{formatDate(item.savedAt, { dateStyle: "medium" })}</small>
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
      {conversation && collections.length > 0 && <label className="field">
        {l10n("workspace.experience.collectionMembership")}
        <select className="input input-sm" value="" disabled={busy} onChange={(e) => {
          const c = collections.find((entry) => entry.id === e.target.value);
          if (c) void mutate({ op: c.messageIds.includes(item.messageId) ? "remove" : "add", id: c.id, messageId: item.messageId });
        }}>
          <option value="">{l10n("workspace.experience.chooseCollection")}</option>
          {collections.map((c) => <option key={c.id} value={c.id}>{l10n(c.messageIds.includes(item.messageId) ? "workspace.experience.removeFrom" : "workspace.experience.addTo", { name: c.name })}</option>)}
        </select>
      </label>}
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
