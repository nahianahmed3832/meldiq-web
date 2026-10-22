import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import type { StoredMessage } from "../../model/types";
import { shortWhen } from "../format";
import { jumpTo } from "./jump";

const MIN_QUERY = 2;
/** Characters of text shown before a match. */
const CONTEXT = 32;

/**
 * Search in this conversation (android ConversationViewModel search): message text on this browser, newest first. The
 * server can't search: it only holds encrypted copies. Choosing a result scrolls to it, loading older messages if needed.
 */
export function SearchPanel({ conversationId, onClose }: { conversationId: string; onClose: () => void }) {
  const engine = useEngine();
  const users = useOrbit((s) => s.users);
  const me = useOrbit((s) => s.me);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<StoredMessage[] | null>(null);
  const [missing, setMissing] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    const term = q.trim();
    if (term.length < MIN_QUERY) return setResults(null);
    let alive = true;
    const t = setTimeout(() => {
      engine
        .searchMessages(term, conversationId)
        .then((r) => alive && setResults(r))
        .catch(() => alive && setResults([]));
    }, 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [engine, conversationId, q]);

  const open = async (m: StoredMessage) => {
    setMissing(null);
    if (!(await jumpTo(engine, conversationId, m.id))) setMissing("That message isn't loaded in this conversation any more.");
  };

  return (
    <aside className="panel" aria-label="Search in this conversation">
      <div className="panel-head">
        <div className="search-input grow" style={{ border: 0, padding: 0 }}>
          <Search size={16} className="faint" />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search in this conversation" aria-label="Search in this conversation" />
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close search">
          <X size={18} />
        </button>
      </div>
      <div className="panel-body scroll">
        {missing && (
          <p className="banner warn" role="status">
            {missing}
          </p>
        )}
        {results === null ? (
          <p className="faint" style={{ padding: "8px 4px" }}>
            Searches the messages kept in this browser. Meldiq's server can't search them: it only holds encrypted copies.
          </p>
        ) : results.length === 0 ? (
          <p className="faint" style={{ padding: "8px 4px" }}>
            No messages here contain “{q.trim()}”.
          </p>
        ) : (
          <ul className="search-results" aria-label={`${results.length} results`}>
            {results.map((m) => (
              <li key={m.id}>
                <button className="list-row" onClick={() => void open(m)}>
                  <span className="lines">
                    <small>
                      {m.outgoing || m.senderUserId === me?.userId ? "You" : (users[m.senderUserId]?.displayName ?? "Someone")} · {shortWhen(m.sortTs)}
                    </small>
                    <span className="clamp-2">
                      <Highlight text={m.text} term={q.trim()} />
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

/** The text with the first match marked (plain text, never HTML). */
function Highlight({ text, term }: { text: string; term: string }) {
  const at = text.toLowerCase().indexOf(term.toLowerCase());
  if (at < 0 || !term) return <>{text}</>;
  // A little context before the match, starting at a word where there is one, so the match itself stays in view.
  const from = Math.max(0, at - CONTEXT);
  const space = text.indexOf(" ", from);
  const start = from === 0 ? 0 : space >= 0 && space < at ? space + 1 : at;
  return (
    <>
      {start > 0 ? "…" : ""}
      {text.slice(start, at)}
      <mark>{text.slice(at, at + term.length)}</mark>
      {text.slice(at + term.length, at + term.length + 160)}
    </>
  );
}
