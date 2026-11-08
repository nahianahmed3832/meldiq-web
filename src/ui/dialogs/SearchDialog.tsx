import { openSpark } from "../../application/experienceNavigation";
import { recordSearch, updateHistory } from "../../application/personalHistory";
import { useLanguage } from "../../i18n";
import { useFocusTrap } from "../components/Overlay";
import { usePersonalHistory } from "../experience/usePersonalHistory";
import { roleName } from "../../sync/workspaceRules";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
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
import { type Filter, FILTERS, PREVIEW_COUNT, type SearchResults, type Section, sections, serverSearch, serverTypes, usable, DEBOUNCE_MS } from "../../sync/universalSearch";
import { Avatar, colorIndexOf } from "../components/Avatar";
import { jumpTo } from "../chat/jump";
import { conversationTitle, members, shortWhen } from "../format";
import { UserAvatar } from "../components/OrgAvatar";
import { parseSearchQuery } from "../../sync/searchQuery";
interface Result {
  key: string;
  section: Section;
  title: string;
  sub: string;
  icon: React.ReactNode;
  go: () => void;
}
const LABEL: Record<Section, string> = {
  get tools() { return uiText("workspace.experience.tools"); },
  get conversations() {
    return uiText("settings.nt_conversations");
  },
  get channels() {
    return uiText("organization.channels");
  },
  get workspaces() {
    return uiText("workspace.interface.communities_c864f32");
  },
  get groups() {
    return uiText("workspace.interface.groups_39bbb71");
  },
  get people() {
    return uiText("calls.interface.people_7db2089");
  },
  get messages() {
    return uiText("workspace.nav_messages");
  },
  get files() {
    return uiText("workspace.interface.files_loaded_here_8ea7c56");
  },
  get pinned() {
    return uiText("workspace.interface.pinned_loaded_here_2f97eca");
  },
};
const FILTER_LABEL: Record<Filter, string> = {
  get tools() { return uiText("workspace.experience.tools"); },
  get all() {
    return uiText("settings.ap_all");
  },
  get messages() {
    return uiText("workspace.nav_messages");
  },
  get files() {
    return uiText("files.files");
  },
  get pinned() {
    return uiText("messaging.interface.pinned_f20c879");
  },
  get people() {
    return uiText("calls.interface.people_7db2089");
  },
  get channels() {
    return uiText("organization.channels");
  },
  get workspaces() {
    return uiText("workspace.interface.communities_c864f32");
  },
};
/** How many results a single-kind filter shows at first, and adds on Show more. */
const PAGE = 20;
const LOCAL_LIMIT = 100;
const RECENT_KEY = "meldiq.recentSearches";
/** Signing out forgets them: what someone searched for isn't left for the next person on this browser. */
export function forgetRecentSearches(): void {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    /* nothing stored */
  }
}
interface Local {
  messages: StoredMessage[];
  files: {
    message: StoredMessage;
    ref: AttachmentRef;
  }[];
  pinned: StoredMessage[];
}
const NO_LOCAL: Local = { messages: [], files: [], pinned: [] };
/**
 * ⌘K search (android round 7 C2 search screen): conversations, messages, files and pinned messages on this browser,
 * and, where the server offers `search`, people, channels, workspaces and groups from the server, which
 * checks each one's own access. Filters, a page per kind with Show more, and recent searches kept on this browser.
 */
export function SearchDialog({ orgId: _orgId, onClose }: { orgId: string | null; onClose: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const conversations = useOrbit((s) => s.conversations);
  const users = useOrbit((s) => s.users);
  const orgs = useOrbit((s) => s.orgs);
  const me = useOrbit((s) => s.me);
  const feedback = useOrbit((s) => s.server?.features.includes("bug-reports") ?? false);
  const universal = useOrbit((s) => s.server?.features.includes("search") ?? false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [server, setServer] = useState<SearchResults>({});
  const [legacyPeople, setLegacyPeople] = useState<Member[]>([]);
  const [local, setLocal] = useState<Local>(NO_LOCAL);
  const [shown, setShown] = useState(PAGE);
  const history = usePersonalHistory(engine.store);
  const recent = history.data?.searches ?? [];
  const language = useLanguage();
  const [sort, setSort] = useState("relevance");
  const [loading, setLoading] = useState(false);
  const [paging, setPaging] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const epoch = useRef(0);
  const modal = useRef<HTMLDivElement>(null);
  useFocusTrap(modal, true);
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const term = usable(q);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);
  useEffect(() => {
    const request = ++epoch.current;
    const controller = new AbortController();
    setShown(PAGE);
    setServer({});
    setLegacyPeople([]);
    setLocal(NO_LOCAL);
    setError(false);
    setPaging(false);
    setLoading(!!term && filter !== "tools");
    if (!term || filter === "tools") return;
    const words = parseSearchQuery(term).text;
    const live = () => request === epoch.current && !controller.signal.aborted;
    const t = setTimeout(() => {
      const types = serverTypes(filter);
      const remote = !words ? Promise.resolve()
        : types && universal
          ? serverSearch(engine, words, { types, limit: filter === "all" ? PREVIEW_COUNT : PAGE, signal: controller.signal })
              .then((result) => { if (live()) setServer(result); })
          : !universal && (filter === "all" || filter === "people")
            ? searchPeople(engine, words).then((result) => { if (live()) setLegacyPeople(result); })
            : Promise.resolve();
      void Promise.allSettled([
        remote,
        Promise.all([
          filter === "all" || filter === "messages" ? engine.searchMessages(term) : [],
          words && (filter === "all" || filter === "files") ? engine.searchFiles(words, LOCAL_LIMIT) : [],
          words && (filter === "all" || filter === "pinned") ? engine.searchPinned(words, LOCAL_LIMIT) : [],
        ]).then(([messages, files, pinned]) => { if (live()) setLocal({ messages, files, pinned }); }),
      ]).then((outcomes) => {
        if (live()) {
          setError(outcomes.some((r) => r.status === "rejected"));
          setLoading(false);
        }
      });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [term, filter, universal, engine, retry]);
  const more = async (section: Section) => {
    if (paging) return;
    const pageOf = server[section as keyof SearchResults];
    if (!term || !pageOf?.next) {
      setShown((n) => n + PAGE);
      return;
    }
    const request = epoch.current;
    setPaging(true);
    try {
      const next = await serverSearch(engine, parseSearchQuery(term).text, { types: section, limit: PAGE, cursor: pageOf.next });
      const add = next[section as keyof SearchResults];
      if (add && request === epoch.current) {
        setServer((cur) => ({ ...cur, [section]: { items: [...(cur[section as keyof SearchResults]?.items ?? []), ...add.items], next: add.next } }));
        setShown((n) => n + PAGE);
      }
    } catch {
      if (request === epoch.current) setError(true);
    } finally {
      if (request === epoch.current) setPaging(false);
    }
  };
  const open = (r: Result) => {
    if (term) void recordSearch(engine.store, term).catch(() => undefined);
    onClose();
    r.go();
  };
  const failed = (e: unknown) => engine.notice("error", e instanceof Error ? e.message : uiText("workspace.interface.couldn_t_open_that_ae9aee4"));
  const openMessage = (m: StoredMessage) => {
    navigate({ section: conversations[m.conversationId]?.type === "CHANNEL" ? "home" : "dms", conversationId: m.conversationId });
    setTimeout(() => void jumpTo(engine, m.conversationId, m.id), 300);
  };
  const inConv = (m: StoredMessage) =>
    me && conversations[m.conversationId] ? conversationTitle(conversations[m.conversationId], me.userId, users) : uiText("workspace.interface.a_conversation_3e95da5");
  const who = (m: StoredMessage) => (m.outgoing ? uiText("workspace.nav_you") : (users[m.senderUserId]?.displayName ?? uiText("messaging.react_someone")));
  const all = useMemo<Record<Section, Result[]>>(() => {
    const out: Record<Section, Result[]> = { tools: [], conversations: [], channels: [], workspaces: [], groups: [], people: [], messages: [], files: [], pinned: [] };
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
            ? [orgName ?? c.scopeName ?? l10n("settings.interface.channel_ce4683e"), c.joined ? null : l10n("workspace.interface.not_joined_opens_and_joins_f207e31")].filter(Boolean).join(" · ")
            : c.type === "GROUP"
              ? l10n("workspace.interface.group_value0_9af23fd", { value0: members(c.memberCount) })
              : l10n("messaging.interface.direct_message_cd3e160"),
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
    const tools = [
      ...(feedback ? [["feedback", l10n("workspace.experience.feedback"), () => navigate({ section: "settings", settingsPage: "about" })] as const] : []),
      ["spark", l10n("workspace.experience.spark"), openSpark],
      ["discover", l10n("workspace.rail_discover"), () => navigate({ section: "discover" })],
      ["later", l10n("top_saved"), () => navigate({ section: "later" })],
      ["activity", l10n("workspace.activity"), () => navigate({ section: "activity" })],
      ["language", l10n("common.language.label"), () => navigate({ section: "settings", settingsPage: "language" })],
      ["security", l10n("settings.settings_security"), () => navigate({ section: "settings", settingsPage: "security" })],
    ] as const;
    out.tools = tools.filter(([key, title]) => !t || title.toLocaleLowerCase().includes(t) || key.includes(t)).map(([key, title, go]) => ({
      key: `tools:${key}`, section: "tools", title, sub: "", icon: null, go,
    }));
    if (!t) return out;
    const peopleList: Member[] = universal ? (server.people?.items ?? []) : legacyPeople;
    out.people = peopleList.map((p) => ({
      key: `people:${p.id}`,
      section: "people",
      title: p.displayName,
      sub: `@${p.username}`,
      icon: <UserAvatar userId={p.id} name={p.displayName} colorIndex={p.avatarColor} photoRev={p.photoRev} size={28} decorative />,
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
      sub: o.myRole ? l10n("workspace.interface.community_value0_d6d7785", { value0: roleName(o.myRole) }) : l10n("organization.community"),
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
        sub: l10n("workspace.interface.value0_in_value1_value2_95e3d8d", { value0: who(m), value1: inConv(m), value2: shortWhen(m.sortTs) }),
        icon: <MessageSquareText size={18} />,
        go: () => openMessage(m),
      }));
    out.files = local.files
      .filter((f) => conversations[f.message.conversationId])
      .map((f) => ({
        key: `files:${f.message.id}:${f.ref.id}`,
        section: "files",
        title: f.ref.name,
        sub: l10n("workspace.interface.value0_in_value1_value2_95e3d8d", { value0: who(f.message), value1: inConv(f.message), value2: shortWhen(f.message.sortTs) }),
        icon: <Paperclip size={18} />,
        go: () => openMessage(f.message),
      }));
    out.pinned = local.pinned
      .filter((m) => conversations[m.conversationId])
      .map((m) => ({
        key: `pinned:${m.id}`,
        section: "pinned",
        title: m.text.length > 90 ? `${m.text.slice(0, 90)}…` : m.text,
        sub: l10n("workspace.interface.pinned_in_value0_value1_72bd210", { value0: inConv(m), value1: shortWhen(m.sortTs) }),
        icon: <Pin size={18} />,
        go: () => openMessage(m),
      }));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recomputed from what was found
  }, [term, conversations, users, me, server, legacyPeople, local, orgs, universal, feedback, engine, l10n]);
  /** What's listed: under All a preview of each kind; under a filter its page so far. */
  const groups = useMemo(() => {
    const wanted = sections(filter).filter((s) => s !== "conversations" || filter === "all");
    const list = filter === "all" ? ["conversations" as Section, ...wanted.filter((s) => s !== "conversations")] : wanted;
    return list
      .map((s) => {
        const items = sort === "title" ? [...all[s]].sort((a, b) => a.title.localeCompare(b.title, language, { sensitivity: "base" })) : all[s];
        const limit = filter === "all" ? (term ? PREVIEW_COUNT : 6) : shown;
        const hasMore = items.length > limit || !!server[s as keyof SearchResults]?.next;
        return { section: s, items: items.slice(0, limit), hasMore: filter !== "all" && hasMore };
      })
      .filter((g) => g.items.length > 0);
  }, [all, filter, shown, term, server, sort, language]);
  const flat = groups.flatMap((g) => g.items);
  useEffect(() => setIndex(0), [q, filter, sort]);
  useEffect(() => {
    if (flat[index]) document.getElementById(`sr-${flat[index].key}`)?.scrollIntoView({ block: "nearest" });
    // Scroll only for the input's keyboard selection, not for background result updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);
  return createPortal(
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={modal} className="dialog" role="dialog" aria-modal="true" aria-label={l10n("common.actions.search")} style={{ width: "min(680px, 100%)" }}>
        <div className="search-input">
          <Search size={18} className="faint" />
          <input
            ref={input}
            data-autofocus
            maxLength={60}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={universal ? uiText("workspace.interface.search_people_channels_and_messages_4c7d430") : l10n("messaging.search_placeholder")}
            aria-label={l10n("common.actions.search")}
            role="combobox"
            aria-expanded="true"
            aria-controls="search-results"
            aria-activedescendant={flat[index] ? `sr-${flat[index].key}` : undefined}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndex((i) => Math.max(0, Math.min(flat.length - 1, i + 1)));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndex((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter" && flat[index]) {
                e.preventDefault();
                open(flat[index]);
              }
            }}
          />
          <button className="icon-btn" onClick={onClose} aria-label={l10n("messaging.conv_close_search")}>
            <X size={18} />
          </button>
        </div>
        <div className="search-filters" role="tablist" aria-label={uiText("messaging.interface.show_0df6f1c")}>
          {FILTERS.filter((f) => universal || (f !== "workspaces" && f !== "channels")).map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} className="chip" onClick={() => setFilter(f)}>
              {FILTER_LABEL[f]}
            </button>
          ))}
        </div>
        <div className="experience-controls" style={{ padding: "0 12px 8px" }}>
          <label>{l10n("workspace.experience.sort")}
            <select className="input input-sm" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="relevance">{l10n("workspace.experience.relevance")}</option>
              <option value="title">{l10n("workspace.experience.titleSort")}</option>
            </select>
          </label>
        </div>
        <div id="search-results" role="listbox" aria-busy={loading || paging} className="scroll" style={{ minHeight: 0, paddingBottom: 8 }}>
          {!term && recent.length > 0 && (
            <div className="result-group">
              <h3>
                <Localized k="workspace.interface.recent_searches_228c84b" />
              </h3>
              <div className="recent-searches">
                {recent.map(({ query }) => (
                  <button key={query} className="chip" onClick={() => { setQ(query); input.current?.focus(); }}>
                    {query}
                  </button>
                ))}
                <button className="btn btn-ghost btn-sm" onClick={() => void updateHistory(engine.store, { type: "clearSearch" }).catch(() => setError(true))}>{l10n("workspace.experience.clearSearch")}</button>
              </div>
            </div>
          )}
          {loading && <div className="experience-skeleton" role="status" aria-label={l10n("workspace.experience.loading")} />}
          {error && <p className="banner danger" role="alert">{l10n("workspace.experience.searchError")} <button className="btn btn-ghost btn-sm" onClick={() => setRetry((n) => n + 1)}>{l10n("workspace.experience.retry")}</button></p>}
          {!loading && !error && flat.length === 0 && term && (
            <div className="empty" style={{ padding: 32 }}>
              <Localized k="workspace.interface.nothing_found_eb1fa11" />
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
                <button className="btn btn-ghost btn-sm" style={{ margin: "2px 8px" }} disabled={paging} onClick={() => void more(g.section)}>
                  {l10n("workspace.discover_more")}
                </button>
              )}
            </div>
          ))}
          {term && universal && filter === "all" && (
            <p className="faint search-note">
              <Localized k="workspace.interface.everything_comes_from_the_server_which_only_shows_what_you_may_se_4d7c10b" slots={[<UsersRound size={12} />]} />
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
