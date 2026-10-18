import { Hash, MessageSquareText, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Member } from "../../api/schemas";
import { useEngine, useOrbit } from "../../app/orbit";
import { navigate } from "../../app/router";
import type { StoredMessage } from "../../model/types";
import { searchPeople, startDirect } from "../../sync/account";
import { Avatar, colorIndexOf } from "../components/Avatar";
import { conversationTitle, shortWhen } from "../format";

interface Result {
  key: string;
  group: "Conversations" | "People" | "Messages";
  title: string;
  sub: string;
  icon: React.ReactNode;
  go: () => void;
}

/** ⌘K: conversations by name, people in your workspaces (the server's directory), and message text on this browser. */
export function SearchDialog({ orgId: _orgId, onClose }: { orgId: string | null; onClose: () => void }) {
  const engine = useEngine();
  const conversations = useOrbit((s) => s.conversations);
  const users = useOrbit((s) => s.users);
  const me = useOrbit((s) => s.me);
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<Member[]>([]);
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setPeople([]);
      setMessages([]);
      return;
    }
    const t = setTimeout(() => {
      searchPeople(engine, term)
        .then(setPeople)
        .catch(() => setPeople([]));
      engine
        .searchMessages(term)
        .then((r) => setMessages(r.slice(0, 12)))
        .catch(() => setMessages([]));
    }, 220);
    return () => clearTimeout(t);
  }, [q, engine]);

  const results = useMemo<Result[]>(() => {
    if (!me) return [];
    const term = q.trim().toLowerCase();
    const convs = Object.values(conversations)
      .map((c) => ({ c, title: conversationTitle(c, me.userId, users) }))
      .filter(({ title }) => !term || title.toLowerCase().includes(term))
      .slice(0, term ? 8 : 6)
      .map<Result>(({ c, title }) => ({
        key: `c:${c.id}`,
        group: "Conversations",
        title: c.type === "CHANNEL" ? `#${title}` : title,
        sub: c.type === "CHANNEL" ? (c.scopeName ?? "Channel") : c.type === "GROUP" ? `Group · ${c.memberCount} members` : "Direct message",
        icon: c.type === "CHANNEL" ? <Hash size={18} /> : <Avatar name={title} colorIndex={colorIndexOf(c.id)} size={28} decorative />,
        go: () => navigate({ section: c.type === "CHANNEL" ? "home" : "dms", conversationId: c.id }),
      }));
    const ppl = people.map<Result>((p) => ({
      key: `u:${p.id}`,
      group: "People",
      title: p.displayName,
      sub: `@${p.username}`,
      icon: <Avatar name={p.displayName} colorIndex={p.avatarColor} size={28} online={p.online} decorative />,
      go: () => {
        void startDirect(engine, p.id)
          .then((id) => navigate({ section: "dms", conversationId: id }))
          .catch((e: unknown) => engine.notice("error", e instanceof Error ? e.message : "Couldn't open the conversation"));
      },
    }));
    const msgs = messages
      .filter((m) => conversations[m.conversationId])
      .map<Result>((m) => ({
        key: `m:${m.id}`,
        group: "Messages",
        title: m.text.length > 90 ? `${m.text.slice(0, 90)}…` : m.text,
        sub: `${m.outgoing ? "You" : (users[m.senderUserId]?.displayName ?? "Someone")} in ${conversationTitle(conversations[m.conversationId], me.userId, users)} · ${shortWhen(m.sortTs)}`,
        icon: <MessageSquareText size={18} />,
        go: () => navigate({ section: "home", conversationId: m.conversationId }),
      }));
    return [...convs, ...ppl, ...msgs];
  }, [q, conversations, users, me, people, messages, engine]);

  useEffect(() => setIndex(0), [q]);

  const choose = (r: Result | undefined) => {
    if (!r) return;
    onClose();
    r.go();
  };

  let lastGroup = "";
  return createPortal(
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Search" style={{ width: "min(640px, 100%)" }}>
        <div className="search-input">
          <Search size={18} className="faint" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search conversations, people and messages"
            aria-label="Search"
            role="combobox"
            aria-expanded="true"
            aria-controls="search-results"
            aria-activedescendant={results[index] ? `sr-${results[index].key}` : undefined}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndex((i) => Math.min(results.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndex((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                choose(results[index]);
              }
            }}
          />
          <button className="icon-btn" onClick={onClose} aria-label="Close search">
            <X size={18} />
          </button>
        </div>
        <div id="search-results" role="listbox" className="scroll" style={{ minHeight: 0, paddingBottom: 8 }}>
          {results.length === 0 && (
            <div className="empty" style={{ padding: 32 }}>
              {q.trim().length < 2 ? "Type to search." : "Nothing found."}
            </div>
          )}
          {results.map((r, i) => {
            const head = r.group !== lastGroup ? r.group : null;
            lastGroup = r.group;
            return (
              <div key={r.key} className={head ? "result-group" : undefined} style={head ? undefined : { padding: "0 8px" }}>
                {head && <h3>{head === "Messages" ? "Messages on this browser" : head}</h3>}
                <button id={`sr-${r.key}`} role="option" aria-selected={i === index} className="result" onMouseEnter={() => setIndex(i)} onClick={() => choose(r)}>
                  <span style={{ width: 28, display: "grid", placeItems: "center" }} className="faint">
                    {r.icon}
                  </span>
                  <span className="lines">
                    <span className="ellipsis">{r.title}</span>
                    <small className="ellipsis">{r.sub}</small>
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
