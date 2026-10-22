import { Building2, Hash, MessageSquareText, Paperclip, Pin, Search, UsersRound, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Conversation, Member } from "../../api/schemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { setPrefs } from "../../application/prefs";
import { navigate } from "../../application/router";
import type { StoredMessage } from "../../model/types";
import type { AttachmentRef } from "../../protocol/payload";
import { joinChannel, searchPeople, startDirect } from "../../sync/account";
import { type Filter, FILTERS, PREVIEW_COUNT, remember, type SearchResults, type Section, sections, serverSearch, serverTypes, usable, DEBOUNCE_MS } from "../../sync/universalSearch";
import { Avatar, colorIndexOf } from "../components/Avatar";
import { jumpTo } from "../chat/jump";
import { conversationTitle, members, shortWhen } from "../format";

interface Result {
  key: string;
  section: Section;
  title: string;
  sub: string;
  icon: React.ReactNode;
  go: () => void;
}

const LABEL: Record<Section, string> = {
  conversations: "Conversations",
  channels: "Channels",
  workspaces: "Workspaces",
  groups: "Groups",
  people: "People",
  messages: "Messages on this browser",
  files: "Files on this browser",
  pinned: "Pinned on this browser",
};
const FILTER_LABEL: Record<Filter, string> = {
  all: "All",
  messages: "Messages",
  files: "Files",
  pinned: "Pinned",
  people: "People",
  channels: "Channels",
  workspaces: "Workspaces",
};
/** How many results a single-kind filter shows at first, and adds on Show more. */
const PAGE = 20;
const LOCAL_LIMIT = 100;
const RECENT_KEY = "meldiq.recentSearches";

function loadRecent(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function saveRecent(list: string[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* kept for this page only */
  }
}

interface Local {
  messages: StoredMessage[];
  files: { message: StoredMessage; ref: AttachmentRef }[];
  pinned: StoredMessage[];
}
const NO_LOCAL: Local = { messages: [], files: [], pinned: [] };

/**
 * ⌘K search (android round 7 C2 search screen): conversations, messages, files and pinned messages on this browser,
 * and, where the server offers `search`, people, channels, workspaces and groups from the server, which
 * checks each one's own access. Filters, a page per kind with Show more, and recent searches kept on this browser.
 */
export function SearchDialog({ orgId: _orgId, onClose }: { orgId: string | null; onClose: () => void }) {
  const engine = useEngine();
  const conversations = useOrbit((s) => s.conversations);
  const users = useOrbit((s) => s.users);
  const orgs = useOrbit((s) => s.orgs);
  const me = useOrbit((s) => s.me);
  const universal = useOrbit((s) => s.server?.features.includes("search") ?? false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [server, setServer] = useState<SearchResults>({});
  const [legacyPeople, setLegacyPeople] = useState<Member[]>([]);
  const [local, setLocal] = useState<Local>(NO_LOCAL);
  const [shown, setShown] = useState(PAGE);
  const [recent, setRecent] = useState(loadRecent);
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const term = usable(q);

  useEffect(() => {
    input.current?.focus();
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);

  useEffect(() => {
    setShown(PAGE);
    if (!term) {
      setServer({});
      setLegacyPeople([]);
      setLocal(NO_LOCAL);
      return;
    }
    let alive = true;
    const t = setTimeout(() => {
      const types = serverTypes(filter);
      if (types && universal)
        serverSearch(engine, term, { types, limit: filter === "all" ? PREVIEW_COUNT : PAGE })
          .then((r) => alive && setServer(r))
          .catch(() => alive && setServer({}));
      else if (!universal && (filter === "all" || filter === "people"))
        searchPeople(engine, term)
          .then((r) => alive && setLegacyPeople(r))
          .catch(() => alive && setLegacyPeople([]));
      void Promise.all([
        filter === "all" || filter === "messages" ? engine.searchMessages(term) : [],
        filter === "all" || filter === "files" ? engine.searchFiles(term, LOCAL_LIMIT) : [],
        filter === "all" || filter === "pinned" ? engine.searchPinned(term, LOCAL_LIMIT) : [],
      ])
        .then(([messages, files, pinned]) => alive && setLocal({ messages, files, pinned }))
        .catch(() => alive && setLocal(NO_LOCAL));
    }, DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [term, filter, universal, engine]);

  /** Show more: the next page of a server kind (its cursor), or more of what's already found on this browser. */
  const more = async (section: Section) => {
    setShown((n) => n + PAGE);
    const pageOf = server[section as keyof SearchResults];
    if (!term || !pageOf?.next) return;
    const next = await serverSearch(engine, term, { types: section, limit: PAGE, cursor: pageOf.next }).catch(() => null);
    const add = next?.[section as keyof SearchResults];
    if (add) setServer((cur) => ({ ...cur, [section]: { items: [...(cur[section as keyof SearchResults]?.items ?? []), ...add.items], next: add.next } }));
  };

  const open = (r: Result) => {
    if (term) {
      const list = remember(recent, term);
      setRecent(list);
      saveRecent(list);
    }
    onClose();
    r.go();
  };

  const failed = (e: unknown) => engine.notice("error", e instanceof Error ? e.message : "Couldn't open that.");
  const openMessage = (m: StoredMessage) => {
    navigate({ section: conversations[m.conversationId]?.type === "CHANNEL" ? "home" : "dms", conversationId: m.conversationId });
    setTimeout(() => void jumpTo(engine, m.conversationId, m.id), 300);
  };
  const inConv = (m: StoredMessage) => (me && conversations[m.conversationId] ? conversationTitle(conversations[m.conversationId], me.userId, users) : "a conversation");
  const who = (m: StoredMessage) => (m.outgoing ? "You" : (users[m.senderUserId]?.displayName ?? "Someone"));

  const all = useMemo<Record<Section, Result[]>>(() => {
    const out: Record<Section, Result[]> = { conversations: [], channels: [], workspaces: [], groups: [], people: [], messages: [], files: [], pinned: [] };
    if (!me) return out;
    const t = term?.toLowerCase() ?? "";
    const convRow = (c: Conversation, section: Section, orgName?: string | null): Result => {
      const title = conversationTitle(c, me.userId, users);
      return {
        key: `${section}:${c.id}`,
        section,
        title: c.type === "CHANNEL" ? `#${title}` : title,
        sub:
          c.type === "CHANNEL"
            ? [orgName ?? c.scopeName ?? "Channel", c.joined ? null : "not joined: opens and joins"].filter(Boolean).join(" · ")
            : c.type === "GROUP"
              ? `Group · ${members(c.memberCount)}`
              : "Direct message",
        icon: c.type === "CHANNEL" ? <Hash size={18} /> : <Avatar name={title} colorIndex={colorIndexOf(c.id)} size={28} decorative />,
        go: () =>
          c.joined || c.type !== "CHANNEL"
            ? navigate({ section: c.type === "CHANNEL" ? "home" : "dms", conversationId: c.id })
            : void joinChannel(engine, c.id)
                .then(() => navigate({ section: "home", conversationId: c.id }))
                .catch(failed),
      };
    };
    out.conversations = Object.values(conversations)
      .filter((c) => !t || conversationTitle(c, me.userId, users).toLowerCase().includes(t))
      .slice(0, t ? LOCAL_LIMIT : 6)
      .map((c) => convRow(c, "conversations"));
    if (!t) return out;
    const peopleList: Member[] = universal ? (server.people?.items ?? []) : legacyPeople;
    out.people = peopleList.map((p) => ({
      key: `people:${p.id}`,
      section: "people",
      title: p.displayName,
      sub: `@${p.username}`,
      icon: <Avatar name={p.displayName} colorIndex={p.avatarColor} size={28} decorative />,
      go: () =>
        void startDirect(engine, p.id)
          .then((id) => navigate({ section: "dms", conversationId: id }))
          .catch(failed),
    }));
    out.channels = (server.channels?.items ?? []).map((c) => convRow(c, "channels", c.orgName));
    out.groups = (server.groups?.items ?? []).map((c) => convRow(c, "groups"));
    out.workspaces = (universal ? (server.workspaces?.items ?? []) : orgs.filter((o) => o.name.toLowerCase().includes(t))).map((o) => ({
      key: `workspaces:${o.id}`,
      section: "workspaces",
      title: o.name,
      sub: o.myRole ? `Workspace · ${o.myRole.toLowerCase()}` : "Workspace",
      icon: <Building2 size={18} />,
      go: () => {
        setPrefs({ orgId: o.id });
        navigate({ section: "home" });
      },
    }));
    out.messages = local.messages
      .filter((m) => conversations[m.conversationId])
      .map((m) => ({
        key: `messages:${m.id}`,
        section: "messages",
        title: m.text.length > 90 ? `${m.text.slice(0, 90)}…` : m.text,
        sub: `${who(m)} in ${inConv(m)} · ${shortWhen(m.sortTs)}`,
        icon: <MessageSquareText size={18} />,
        go: () => openMessage(m),
      }));
    out.files = local.files
      .filter((f) => conversations[f.message.conversationId])
      .map((f) => ({
        key: `files:${f.message.id}:${f.ref.id}`,
        section: "files",
        title: f.ref.name,
        sub: `${who(f.message)} in ${inConv(f.message)} · ${shortWhen(f.message.sortTs)}`,
        icon: <Paperclip size={18} />,
        go: () => openMessage(f.message),
      }));
    out.pinned = local.pinned
      .filter((m) => conversations[m.conversationId])
      .map((m) => ({
        key: `pinned:${m.id}`,
        section: "pinned",
        title: m.text.length > 90 ? `${m.text.slice(0, 90)}…` : m.text,
        sub: `Pinned in ${inConv(m)} · ${shortWhen(m.sortTs)}`,
        icon: <Pin size={18} />,
        go: () => openMessage(m),
      }));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recomputed from what was found
  }, [term, conversations, users, me, server, legacyPeople, local, orgs, universal, engine]);

  /** What's listed: under All a preview of each kind; under a filter its page so far. */
  const groups = useMemo(() => {
    const wanted = sections(filter).filter((s) => s !== "conversations" || filter === "all");
    const list = filter === "all" ? ["conversations" as Section, ...wanted.filter((s) => s !== "conversations")] : wanted;
    return list
      .map((s) => {
        const items = all[s];
        const limit = filter === "all" ? (term ? PREVIEW_COUNT : 6) : shown;
        const hasMore = items.length > limit || !!server[s as keyof SearchResults]?.next;
        return { section: s, items: items.slice(0, limit), hasMore: filter !== "all" && hasMore };
      })
      .filter((g) => g.items.length > 0);
  }, [all, filter, shown, term, server]);
  const flat = groups.flatMap((g) => g.items);

  useEffect(() => setIndex(0), [q, filter]);

  return createPortal(
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Search" style={{ width: "min(680px, 100%)" }}>
        <div className="search-input">
          <Search size={18} className="faint" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={universal ? "Search people, channels and messages" : "Search conversations, people and messages"}
            aria-label="Search"
            role="combobox"
            aria-expanded="true"
            aria-controls="search-results"
            aria-activedescendant={flat[index] ? `sr-${flat[index].key}` : undefined}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndex((i) => Math.min(flat.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndex((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter" && flat[index]) {
                e.preventDefault();
                open(flat[index]);
              }
            }}
          />
          <button className="icon-btn" onClick={onClose} aria-label="Close search">
            <X size={18} />
          </button>
        </div>
        <div className="search-filters" role="tablist" aria-label="Show">
          {FILTERS.filter((f) => universal || (f !== "workspaces" && f !== "channels")).map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} className="chip" onClick={() => setFilter(f)}>
              {FILTER_LABEL[f]}
            </button>
          ))}
        </div>
        <div id="search-results" role="listbox" className="scroll" style={{ minHeight: 0, paddingBottom: 8 }}>
          {!term && recent.length > 0 && (
            <div className="result-group">
              <h3>Recent searches</h3>
              <div className="recent-searches">
                {recent.map((r) => (
                  <button key={r} className="chip" onClick={() => setQ(r)}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}
          {flat.length === 0 && term && (
            <div className="empty" style={{ padding: 32 }}>
              Nothing found.
            </div>
          )}
          {groups.map((g) => (
            <div key={g.section} className="result-group">
              <h3>{LABEL[g.section]}</h3>
              {g.items.map((r) => {
                const i = flat.indexOf(r);
                return (
                  <button key={r.key} id={`sr-${r.key}`} role="option" aria-selected={i === index} className="result" onMouseEnter={() => setIndex(i)} onClick={() => open(r)}>
                    <span style={{ width: 28, display: "grid", placeItems: "center" }} className="faint">
                      {r.icon}
                    </span>
                    <span className="lines">
                      <span className="ellipsis">{r.title}</span>
                      <small className="ellipsis">{r.sub}</small>
                    </span>
                  </button>
                );
              })}
              {g.hasMore && (
                <button className="btn btn-ghost btn-sm" style={{ margin: "2px 8px" }} onClick={() => void more(g.section)}>
                  Show more
                </button>
              )}
            </div>
          ))}
          {term && universal && filter === "all" && (
            <p className="faint search-note">
              <UsersRound size={12} /> People, channels and workspaces come from the server, which only shows what you may see. Messages and files are searched on this browser: they're end-to-end
              encrypted.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
