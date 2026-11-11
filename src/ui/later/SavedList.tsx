import { useT } from "../../i18n";
import { formatDate } from "../../i18n/format";
import type { CollectionOp, SavedCollection } from "../../sync/savedCollections";
import type { LaterViewState } from "../../application/laterView";
import { useAction, useLoad } from "../workspace/useLoad";
import { CollectionEditor } from "./CollectionControls";
import { Dialog } from "../components/Overlay";
import { openInApp } from "../chat/inAppLinks";
import { messageLink } from "../../sync/messageLinks";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { useT as useLocalization } from "../../i18n";
import { MeldlingArt } from "../components/MeldlingArt";
import { AlarmClock, Check, MessageSquare, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import type { StoredMessage } from "../../model/types";
import { PERSONAL, type SavedItem, savedDone, savedOpen } from "../../sync/navPrefs";
import { preview } from "../../sync/rules";
import { conversationTitle } from "../format";
import { RemindMeDialog } from "./RemindMeDialog";
import { whenLabel } from "./when";
import { useSavedCollections } from "./useSavedCollections";

/** Saved references sync across devices; content is read only from an accessible conversation in this browser. */
export function SavedList({ view, onViewChange, onSearch }: { view: LaterViewState; onViewChange: (patch: Partial<LaterViewState>) => void; onSearch: () => void }) {
  const t = useT();
  const engine = useEngine();
  const prefs = useOrbit((s) => s.nav[PERSONAL]);
  const synced = useOrbit((s) => s.synced);
  const supported = useOrbit((s) => s.server?.features.includes("saved-items") ?? false);
  const collectionsOn = useOrbit((s) => s.server?.features.includes("saved-collections") ?? false);
  const conversations = useOrbit((s) => s.conversations);
  const users = useOrbit((s) => s.users);
  const me = useOrbit((s) => s.me);
  const { filter, query, collectionId } = view;
  const [editor, setEditor] = useState<"new" | SavedCollection | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [limit, setLimit] = useState(20);
  const input = useRef<HTMLInputElement>(null);
  const mutationLock = useRef(false);
  const collections = useSavedCollections(engine.api, collectionsOn, prefs?.saved);
  const act = useAction();
  const mutate = (op: CollectionOp) => {
    if (mutationLock.current) return Promise.resolve(false);
    mutationLock.current = true;
    return act
      .act(() => collections.mutate(op))
      .finally(() => {
        mutationLock.current = false;
      });
  };
  const change = (patch: Partial<LaterViewState>) => {
    onViewChange(patch);
    setLimit(20);
  };
  const clear = () => {
    change({ query: "", filter: "all", collectionId: "" });
    input.current?.focus();
  };
  const saved = prefs?.saved;
  const word = query.trim().toLocaleLowerCase();
  const previews = useLoad(async () => {
    if (!word) return { word, ids: new Set<string>() };
    const found = await Promise.all(
      (saved ?? [])
        .filter((i) => !!conversations[i.conversationId])
        .map(async (i) => {
          const m = await engine.store.message(i.messageId);
          return m && !m.deleted && m.conversationId === i.conversationId && preview(m).toLocaleLowerCase().includes(word) ? i.messageId : null;
        }),
    );
    return { word, ids: new Set(found) };
  }, [engine, saved, conversations, word]);
  const collection = collections.data?.find((c) => c.id === collectionId);
  const collectionUnavailable = !!collectionId && (!collectionsOn || (!!collections.data && !collections.loading && !collections.error && !collection));
  const ids = collection && new Set(collection.messageIds);
  const all = [...savedOpen(prefs), ...savedDone(prefs)];
  const visible = all.filter((i) => {
    if (collectionId && (!ids || !ids.has(i.messageId))) return false;
    if ((filter === "open" && i.done) || (filter === "done" && !i.done)) return false;
    if (!word) return true;
    const c = conversations[i.conversationId];
    return !!(c && me && conversationTitle(c, me.userId, users).toLocaleLowerCase().includes(word)) || !!(c && previews.data?.word === word && previews.data.ids.has(i.messageId));
  });
  const waiting = (!synced && !prefs) || (collectionsOn && collections.loading && !collections.data) || !!(word && (previews.loading || (!previews.error && previews.data?.word !== word)));
  const failed = !!(word && previews.error) || !!(collectionId && collections.error);
  const filtered = !!word || !!collectionId || filter !== "all";
  if (synced && !supported) return <p className="muted">{t("workspace.interface.this_meldiq_server_doesn_t_keep_saved_messages_yet_bd4799e")}</p>;
  return (
    <div className="experience-panel saved-panel">
      <div className="saved-toolbar">
        <div className="saved-filters" role="search" aria-label={t("workspace.experience.findSaved")}>
          <label className="saved-query">
            {t("workspace.experience.findSaved")}
            <input
              ref={input}
              className="input"
              type="search"
              value={query}
              onChange={(e) => change({ query: e.target.value })}
              maxLength={100}
              placeholder={t("workspace.experience.savedSearchHint")}
            />
          </label>
          <label>
            {t("messaging.interface.show_0df6f1c")}
            <select className="input" value={filter} onChange={(e) => change({ filter: e.target.value as LaterViewState["filter"] })}>
              <option value="open">{t("workspace.experience.openSaved")}</option>
              <option value="done">{t("common.actions.done")}</option>
              <option value="all">{t("settings.ap_all")}</option>
            </select>
          </label>
          {collectionsOn && (
            <label>
              {t("workspace.experience.collections")}
              <select className="input" value={collectionId} onChange={(e) => change({ collectionId: e.target.value })} disabled={!collections.data}>
                <option value="">{t("workspace.experience.allSaved")}</option>
                {collectionId && !collection && <option value={collectionId}>{t(collections.loading ? "workspace.experience.loading" : "workspace.experience.unavailableCollection")}</option>}
                {(collections.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="saved-tools">
          {collectionsOn && (
            <button
              className="btn btn-secondary btn-sm"
              disabled={act.busy || !collections.data || collections.data.length >= 20}
              onClick={(event) => {
                event.currentTarget.focus();
                act.clear();
                setEditor("new");
              }}
            >
              {t("workspace.experience.newCollection")}
            </button>
          )}
          <span className="grow" />
          <button className="btn btn-ghost btn-sm" disabled={!filtered} onClick={clear}>
            {t("workspace.experience.clearFilters")}
          </button>
        </div>
      </div>
      {collection && (
        <div className="saved-collection-heading">
          <h2>{collection.name}</h2>
          <div className="experience-heading-actions">
            <button
              className="btn btn-ghost btn-sm"
              disabled={act.busy}
              onClick={(event) => {
                event.currentTarget.focus();
                act.clear();
                setEditor(collection);
              }}
            >
              {t("workspace.experience.renameCollection")}
            </button>
            <button
              className="btn btn-danger-quiet btn-sm"
              disabled={act.busy}
              onClick={(event) => {
                event.currentTarget.focus();
                act.clear();
                setDeleting(true);
              }}
            >
              {t("workspace.experience.deleteCollection")}
            </button>
          </div>
        </div>
      )}
      {!editor && !deleting && (collections.error || previews.error || act.error) && (
        <div className="banner danger" role="alert">
          {collections.error ?? previews.error ?? act.error}{" "}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              act.clear();
              collections.reload();
              previews.reload();
            }}
          >
            {t("workspace.experience.retry")}
          </button>
        </div>
      )}
      {collectionUnavailable && (
        <div className="saved-empty" role="status">
          <h2>{t("workspace.experience.unavailableCollection")}</h2>
          <p>{t("workspace.experience.unavailableCollectionHelp")}</p>
          <button className="btn btn-secondary" onClick={() => change({ collectionId: "" })}>
            {t("workspace.experience.allSaved")}
          </button>
        </div>
      )}
      {waiting && (
        <div className="saved-loading" role="status" aria-label={t("workspace.experience.loading")}>
          <div className="experience-skeleton" />
          <div className="experience-skeleton" />
          <div className="experience-skeleton" />
        </div>
      )}
      {!waiting && !failed && !collectionUnavailable && (
        <>
          <p className="saved-result-count" role="status">
            {t("workspace.experience.savedResults", { count: visible.length })}
          </p>
          {visible.length === 0 ? (
            <div className="saved-empty">
              <MeldlingArt pose="love" />
              <h2>{all.length ? t("workspace.experience.noSavedMatches") : t("workspace.interface.nothing_saved_e620849")}</h2>
              <p>{t(all.length ? "workspace.experience.noSavedMatchesHelp" : "workspace.interface.save_a_message_for_later_from_its_menu_save_for_later_it_shows_up_bc76302")}</p>
              <button
                className="btn btn-primary"
                onClick={(event) => {
                  event.currentTarget.focus();
                  if (all.length) clear();
                  else onSearch();
                }}
              >
                {t(all.length ? "workspace.experience.clearFilters" : "workspace.interface.search_meldiq_7c5a6e1")}
              </button>
            </div>
          ) : (
            <div className="saved-results">
              {visible.slice(0, limit).map((i) => (
                <SavedRow key={i.messageId} item={i} collections={collections.data ?? []} busy={act.busy} mutate={mutate} />
              ))}
            </div>
          )}
          {visible.length > limit && (
            <button className="btn btn-secondary btn-sm" onClick={() => setLimit(limit + 20)}>
              {t("workspace.discover_more")}
            </button>
          )}
        </>
      )}
      {editor && <CollectionEditor collection={editor === "new" ? undefined : editor} busy={act.busy} error={act.error} save={mutate} close={() => setEditor(null)} />}
      {deleting && collection && (
        <Dialog
          title={t("workspace.experience.deleteCollection")}
          onClose={() => setDeleting(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setDeleting(false)}>
                {t("common.actions.cancel")}
              </button>
              <button
                className="btn btn-danger"
                disabled={act.busy}
                onClick={() =>
                  void mutate({ op: "delete", id: collection.id }).then((ok) => {
                    if (ok) {
                      change({ collectionId: "" });
                      setDeleting(false);
                    }
                  })
                }
              >
                {t("workspace.experience.deleteCollection")}
              </button>
            </>
          }
        >
          <div className="dialog-body">
            <p>{t("workspace.experience.deleteCollectionHelp")}</p>
            {act.error && (
              <p className="banner danger" role="alert">
                {act.error}
              </p>
            )}
          </div>
        </Dialog>
      )}
      <p className="saved-footnote">
        {engine.state.get().reminders.available
          ? t("workspace.interface.reminders_on_saved_messages_go_off_on_all_your_devices_even_with_18652e8")
          : t("workspace.interface.reminders_on_saved_messages_show_while_meldiq_is_open_on_a_device_9da64ef")}
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
            {conversation && message === undefined
              ? "…"
              : accessible && !accessible.deleted
                ? preview(accessible) || l10n("messaging.message")
                : uiText("workspace.interface.open_the_conversation_to_see_this_message_3a90a91")}
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
      {conversation && collections.length > 0 && (
        <label className="field">
          {l10n("workspace.experience.collectionMembership")}
          <select
            className="input input-sm"
            value=""
            disabled={busy}
            onChange={(e) => {
              const c = collections.find((entry) => entry.id === e.target.value);
              if (c) void mutate({ op: c.messageIds.includes(item.messageId) ? "remove" : "add", id: c.id, messageId: item.messageId });
            }}
          >
            <option value="">{l10n("workspace.experience.chooseCollection")}</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {l10n(c.messageIds.includes(item.messageId) ? "workspace.experience.removeFrom" : "workspace.experience.addTo", { name: c.name })}
              </option>
            ))}
          </select>
        </label>
      )}
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
