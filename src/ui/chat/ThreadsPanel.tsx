import { countLabel } from "../../i18n/counts";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { MeldlingArt } from "../components/MeldlingArt";
import { Search, X } from "lucide-react";
import { useState } from "react";
import { useOrbit } from "../../application/orbit";
import { navigate, type Section } from "../../application/router";
import { filterThreads } from "../../sync/threads";
import { collectionThreads } from "../../sync/messageCollections";
import { CollectionControls, useMessageCollection } from "./useMessageCollection";
import { relative } from "../format";
/**
 * A channel's Threads: server pages with authoritative counts, latest reply first, and a clearly labeled cached
 * fallback for older servers. Titles can be filtered within each page.
 */
export function ThreadsPanel({ conversationId, section, onClose }: { conversationId: string; section: Section; onClose: () => void }) {
  useLocaleRender();
  return (
    <aside className="panel" aria-label={uiText("messaging.interface.threads_3e42e38")}>
      <div className="panel-head">
        <div className="grow">
          <h2>
            <Localized k="messaging.interface.threads_3e42e38" />
          </h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label={uiText("messaging.interface.close_panel_a600b90")}>
          <X size={18} />
        </button>
      </div>
      <div className="panel-body scroll" style={{ display: "grid", gap: 8, alignContent: "start", padding: 12 }}>
        <ThreadList conversationId={conversationId} section={section} />
      </div>
    </aside>
  );
}
/** The thread rows themselves, with their search (also the Threads tab of a channel's details, batch B14b). */
export function ThreadList({ conversationId, section }: { conversationId: string; section: Section }) {
  useLocaleRender();
  const l10n = useLocalization();
  const users = useOrbit((s) => s.users);
  const collection = useMessageCollection(conversationId, "threads");
  const [q, setQ] = useState("");
  const rows = collection.page ? collectionThreads(collection.page) : null;
  const shown = rows ? filterThreads(rows, q) : null;
  return (
    <>
      <CollectionControls collection={collection} />
      <label className="forum-search">
        <Search size={15} aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={uiText("messaging.interface.filter_this_page_0640b1e")}
          aria-label={uiText("messaging.interface.search_threads_560d3e8")}
        />
      </label>
      {!shown && collection.loading && <span className="skeleton" style={{ height: 80 }} />}
      {shown?.length === 0 && (
        <div className="empty" style={{ padding: 16 }}>
          <MeldlingArt pose="loading" />
          <p className="muted">
            {q ? uiText("messaging.interface.no_thread_matches_899c483") : uiText("messaging.interface.no_threads_here_yet_to_start_one_open_a_message_s_menu_and_choose_1671b8a")}
          </p>
        </div>
      )}
      {shown?.map((r) => (
        <button key={r.rootId} className="list-row" onClick={() => navigate({ section, conversationId, panel: "thread", threadRoot: r.rootId })}>
          <span className="lines">
            <span className="ellipsis" style={{ fontWeight: 600 }}>
              {r.title}
            </span>
            <small className="ellipsis">
              {r.outgoing ? l10n("workspace.nav_you") : (users[r.senderId]?.displayName ?? l10n("messaging.react_someone"))} · {countLabel(r.replies, "replies")} · {relative(r.lastReplyTs)}
            </small>
          </span>
        </button>
      ))}
    </>
  );
}
