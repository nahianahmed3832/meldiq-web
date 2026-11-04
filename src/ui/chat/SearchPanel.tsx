import { SEARCH_SYNTAX } from "../../i18n/syntax";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import type { StoredMessage } from "../../model/types";
import { shortWhen } from "../format";
import { jumpTo } from "./jump";
import { hasFilters, parseSearchQuery } from "../../sync/searchQuery";
import { StatePanel } from "../components/StatePanel";
/** Filters added by a tap (android search chips): the text typed after them narrows further. */
const CHIPS: {
  label: string;
  token: string;
}[] = [
  {
    get label() {
      return uiText("messaging.interface.from_2181976");
    },
    token: "from:",
  },
  {
    get label() {
      return uiText("messaging.interface.photos_5e3147a");
    },
    token: "has:image ",
  },
  {
    get label() {
      return uiText("messaging.interface.videos_c9a9639");
    },
    token: "has:video ",
  },
  {
    get label() {
      return uiText("files.files");
    },
    token: "has:file ",
  },
  {
    get label() {
      return uiText("messaging.interface.links_9024c19");
    },
    token: "has:link ",
  },
  {
    get label() {
      return uiText("messaging.interface.before_9bb7250");
    },
    token: "before:",
  },
  {
    get label() {
      return uiText("messaging.interface.after_7b68fe5");
    },
    token: "after:",
  },
];
const MIN_QUERY = 2;
/** Characters of text shown before a match. */
const CONTEXT = 32;
/**
 * Search this conversation's server text and loaded history, newest first. Filters narrow the retrieved/loaded
 * candidates. Choosing a result opens a separate history window when its message is outside the current timeline.
 */
export function SearchPanel({ conversationId, onClose }: { conversationId: string; onClose: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const users = useOrbit((s) => s.users);
  const me = useOrbit((s) => s.me);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<StoredMessage[] | null>(null);
  const [missing, setMissing] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [attempt, setAttempt] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const parsed = parseSearchQuery(q);
  useEffect(() => {
    const term = q.trim();
    const query = parseSearchQuery(term);
    setResults(null);
    if (query.text.length < MIN_QUERY && !hasFilters(query)) {
      setStatus("idle");
      return;
    }
    setStatus("loading");
    let alive = true;
    const t = setTimeout(() => {
      engine
        .searchMessages(term, conversationId)
        .then((r) => {
          if (alive) {
            setResults(r);
            setStatus("idle");
          }
        })
        .catch(() => alive && setStatus("error"));
    }, 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [engine, conversationId, q, attempt]);
  const open = async (m: StoredMessage) => {
    setMissing(null);
    if (!(await jumpTo(engine, conversationId, m.id))) setMissing(uiText("messaging.interface.that_message_isn_t_loaded_in_this_conversation_any_more_d58914f"));
  };
  return (
    <aside className="panel" aria-label={l10n("messaging.conv_search")}>
      <div className="panel-head">
        <div className="search-input grow" style={{ border: 0, padding: 0 }}>
          <Search size={16} className="faint" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={uiText("messaging.interface.search_or_from_has_before_after_e3451bd")}
            aria-label={l10n("messaging.conv_search")}
          />
        </div>
        <button className="icon-btn" onClick={onClose} aria-label={l10n("messaging.conv_close_search")}>
          <X size={18} />
        </button>
      </div>
      <div className="search-chips" role="group" aria-label={uiText("messaging.interface.filters_546ebb8")}>
        {CHIPS.map((c) => (
          <button
            key={c.token}
            type="button"
            className="chip"
            onClick={() => {
              setQ((v) => `${v.trim() ? `${v.trim()} ` : ""}${c.token}`);
              input.current?.focus();
            }}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="panel-body scroll">
        {missing && (
          <p className="banner warn" role="status">
            {missing}
          </p>
        )}
        {status === "error" ? (
          <StatePanel error title={l10n("messaging.interface.couldn_t_load_messages_try_again_9068b8c")}>
            <button className="btn btn-secondary btn-sm" onClick={() => setAttempt((n) => n + 1)}>
              {l10n("common.actions.retry")}
            </button>
          </StatePanel>
        ) : status === "loading" ? (
          <StatePanel loading title={l10n("common.status.loading")} />
        ) : results === null ? (
          <p className="faint" style={{ padding: "8px 4px" }}>
            <Localized
              k="messaging.interface.searches_every_message_in_your_conversations_narrow_it_with_from_43f8bc9"
              slots={[
                <code dir="ltr" style={{ overflowWrap: "anywhere", whiteSpace: "normal" }}>
                  {SEARCH_SYNTAX}
                </code>,
              ]}
            />
          </p>
        ) : results.length === 0 ? (
          <p className="faint" style={{ padding: "8px 4px" }}>
            {parsed.text ? (
              <>
                <Localized k="messaging.interface.no_messages_here_match_9c35026" slots={[q.trim()]} />
              </>
            ) : (
              uiText("messaging.interface.no_messages_here_match_these_filters_3b8afd8")
            )}
          </p>
        ) : (
          <ul className="search-results" aria-label={uiText("messaging.interface.value0_results_d48e3f2", { value0: results.length })}>
            {results.map((m) => (
              <li key={m.id}>
                <button className="list-row" onClick={() => void open(m)}>
                  <span className="lines">
                    <small>
                      {m.outgoing || m.senderUserId === me?.userId ? l10n("workspace.nav_you") : (users[m.senderUserId]?.displayName ?? l10n("messaging.react_someone"))} · {shortWhen(m.sortTs)}
                    </small>
                    <span className="clamp-2">{parsed.text ? <Highlight text={m.text} term={parsed.text} /> : m.text || uiText("messaging.interface.attachment_040d2b3")}</span>
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
  useLocaleRender();
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
