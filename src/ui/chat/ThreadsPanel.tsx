import { MeldlingArt } from "../components/MeldlingArt";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate, type Section } from "../../application/router";
import { filterThreads, threadRows, type ThreadRow } from "../../sync/threads";
import { relative } from "../format";

/** Messages a channel's thread list reads from this browser's store. */
const WINDOW = 5000;

/**
 * A channel's Threads (batch B5, android ThreadsSheet): every thread this browser has, latest reply first, with who
 * started it, its replies and when; searchable by name. Built here, because messages are end-to-end encrypted.
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
  const engine = useEngine();
  const users = useOrbit((s) => s.users);
  const rev = useOrbit((s) => s.threadRev);
  const [rows, setRows] = useState<ThreadRow[] | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    let alive = true;
    void engine.conversationMessages(conversationId, WINDOW).then((m) => alive && setRows(threadRows(m)));
    return () => {
      alive = false;
    };
  }, [engine, conversationId, rev]);
  const shown = rows ? filterThreads(rows, q) : null;
  return (
    <>
      <label className="forum-search">
        <Search size={15} aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search threads" aria-label="Search threads" />
      </label>
      {!shown && <span className="skeleton" style={{ height: 80 }} />}
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
