import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { titleOf } from "../../sync/forumRules";
import { ThreadsPanel } from "./ThreadsPanel";
import { useEffect, useMemo, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate, type Route } from "../../application/router";
import type { StoredMessage } from "../../model/types";
import { conversationTitle } from "../format";
import { Composer } from "./Composer";
import { DetailsPanel } from "./ConversationDetails";
import { MessageList } from "./MessageList";
import { PanelHead } from "./PanelHead";
import { SearchPanel } from "./SearchPanel";
import { PinnedPanel } from "./PinnedPanel";
import { hasPeoplePanel, PeoplePanel } from "./PeoplePanels";
import { CollectionControls, useMessageCollection } from "./useMessageCollection";
export function SidePanel({ route }: { route: Route }) {
  useLocaleRender();
  const close = () => navigate({ section: route.section, conversationId: route.conversationId });
  if (!route.conversationId) return null;
  if (route.panel === "search") return <SearchPanel conversationId={route.conversationId} onClose={close} />;
  if (route.panel === "pinned") return <PinnedPanel conversationId={route.conversationId} onClose={close} />;
  if (route.panel === "members") return <PeopleRoutePanel conversationId={route.conversationId} onClose={close} />;
  if (route.panel === "threads") return <ThreadsPanel conversationId={route.conversationId} section={route.section} onClose={close} />;
  return route.panel === "thread" && route.threadRoot ? (
    <ThreadPanel conversationId={route.conversationId} root={route.threadRoot} onClose={close} />
  ) : (
    <DetailsPanel conversationId={route.conversationId} onClose={close} />
  );
}
function PeopleRoutePanel({ conversationId, onClose }: { conversationId: string; onClose: () => void }) {
  useLocaleRender();
  const c = useOrbit((s) => s.conversations[conversationId]);
  return c && hasPeoplePanel(c) ? <PeoplePanel c={c} onClose={onClose} /> : null;
}
function ThreadPanel({ conversationId, root, onClose }: { conversationId: string; root: string; onClose: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const c = useOrbit((s) => s.conversations[conversationId]);
  const loaded = useOrbit((s) => s.messages[conversationId]?.items);
  const me = useOrbit((s) => s.me);
  const users = useOrbit((s) => s.users);
  const collection = useMessageCollection(conversationId, "thread", root);
  // An older post or thread (beyond the conversation's loaded page) comes from this browser's store.
  const [older, setOlder] = useState<StoredMessage[]>([]);
  const inLoaded = !!loaded?.some((m) => m.id === root);
  useEffect(() => {
    if (collection.supported || inLoaded) return setOlder([]);
    let alive = true;
    void engine.conversationMessages(conversationId, 5000).then((list) => alive && setOlder(list.filter((m) => m.id === root || m.threadRootId === root)));
    return () => {
      alive = false;
    };
  }, [engine, conversationId, root, inLoaded, collection.supported]);
  const items = useMemo(() => {
    if (collection.supported) return [...(collection.page?.context ?? []), ...(collection.page?.messages ?? [])].sort((a, b) => a.sortTs - b.sortTs || a.id.localeCompare(b.id));
    const byId = new Map(older.map((m) => [m.id, m]));
    for (const m of loaded ?? []) byId.set(m.id, m);
    return [...byId.values()].sort((a, b) => a.sortTs - b.sortTs);
  }, [loaded, older, collection.supported, collection.page]);
  const rootMsg: StoredMessage | undefined = items.find((m) => m.id === root);
  const replies = items.filter((m) => m.threadRootId === root).length;
  const [following, setFollowing] = useState<boolean | null>(null);
  useEffect(() => {
    void engine.isFollowed(root).then(setFollowing);
  }, [engine, root]);
  // Looking at the thread sees its replies (Activity › Thread replies), including ones that arrive while it's open.
  useEffect(() => {
    void engine.markThreadSeen(root);
  }, [engine, root, replies]);
  if (!c || !me) return null;
  const title = conversationTitle(c, me.userId, users);
  const postTitle = c.format === "forum" && rootMsg ? titleOf(rootMsg.rich?.title, rootMsg.text) : null;
  return (
    <aside className="panel" aria-label={l10n("messaging.thread")}>
      <PanelHead
        title={postTitle || l10n("messaging.thread")}
        sub={c.type === "CHANNEL" ? uiText("messaging.interface.value0_dbac6f0", { value0: title }) : title}
        onClose={onClose}
        actions={
          following !== null && (
            <button className="btn btn-secondary btn-sm" aria-pressed={following} onClick={() => void engine.setFollowed(root, !following).then(() => setFollowing(!following))}>
              {following ? uiText("messaging.interface.following_344b427") : uiText("messaging.interface.follow_641d1ef")}
            </button>
          )
        }
      />
      <CollectionControls collection={collection} />
      {rootMsg || (collection.supported && collection.page) ? (
        <>
          {!rootMsg && (
            <p className="faint" role="status">
              <Localized k="messaging.interface.the_first_message_is_outside_your_available_history_you_can_still_4e4a250" />
            </p>
          )}
          <MessageList
            key={`${conversationId}:${root}`}
            conversationId={conversationId}
            items={items}
            hasMore={false}
            onLoadOlder={() => undefined}
            threadRoot={root}
            canPost={c.canPost}
            onReply={() => undefined}
            onThread={null}
            onReview={() => undefined}
          />
          <Composer conversation={c} title={title} replyTo={null} replyName={null} onCancelReply={() => undefined} threadRoot={root} dropped={[]} onDroppedTaken={() => undefined} />
        </>
      ) : (
        <div className="empty">
          <p>
            {collection.loading
              ? uiText("messaging.interface.loading_this_thread_f236e3a")
              : collection.error
                ? uiText("messaging.interface.this_thread_couldn_t_be_loaded_use_refresh_to_try_again_0a717e0")
                : uiText("messaging.interface.this_thread_isn_t_available_in_this_browser_s_cached_history_6a933ff")}
          </p>
        </div>
      )}
    </aside>
  );
}
