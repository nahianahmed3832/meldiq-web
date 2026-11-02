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
  return (
    <aside className="panel" aria-label="Threads">
      <div className="panel-head">
        <div className="grow">
          <h2>Threads</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close panel">
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
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter this page" aria-label="Search threads" />
      </label>
      {!shown && collection.loading && <span className="skeleton" style={{ height: 80 }} />}
      {shown?.length === 0 && (
        <div className="empty" style={{ padding: 16 }}>
          <MeldlingArt pose="loading" />
          <p className="muted">{q ? "No thread matches." : "No threads here yet. To start one, open a message's menu and choose Reply in thread."}</p>
        </div>
      )}
      {shown?.map((r) => (
        <button key={r.rootId} className="list-row" onClick={() => navigate({ section, conversationId, panel: "thread", threadRoot: r.rootId })}>
          <span className="lines">
            <span className="ellipsis" style={{ fontWeight: 600 }}>
              {r.title}
            </span>
            <small className="ellipsis">
              {r.outgoing ? "You" : (users[r.senderId]?.displayName ?? "Someone")} · {r.replies === 1 ? "1 reply" : `${r.replies} replies`} · {relative(r.lastReplyTs)}
            </small>
          </span>
        </button>
      ))}
    </>
  );
}
