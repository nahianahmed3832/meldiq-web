import { LockOpen, MessagesSquare, Search, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import type { OrgAdminDetail } from "../../../api/workspaceSchemas";
import { useEngine, useOrbit } from "../../../app/orbit";
import { navigate } from "../../../app/router";
import { customerLabel, HANDLING_LABEL, type InboxConversation, inboxConversations, type InboxView, PRIORITY_LABEL, PROVIDERS, providerBadge, VIEW_LABEL, VIEWS } from "../../../sync/inbox";
import { shortWhen } from "../../format";
import { useLoad } from "../useLoad";
import { Card, ErrorLine } from "../WorkspaceView";
import { InboxConversationScreen } from "./InboxConversation";
import { InboxSetup } from "./InboxSetup";

/** The list refreshes on the server's inbox events, and this often as a fallback (android REFRESH_MS). */
const REFRESH_MS = 30_000;
const SEARCH_DELAY_MS = 300;

/** Customer messages reach the server from the provider, so they can't be end-to-end encrypted; every screen says so. */
export function NotE2eeNote() {
  return (
    <span className="faint ib-note">
      <LockOpen size={12} /> Customer messages aren't end-to-end encrypted: the provider delivers them to the server, which keeps them sealed.
    </span>
  );
}

/**
 * Workspace › Customer inbox (android round 8 InboxScreen, server docs/UNIFIED_INBOX.md): conversations from the
 * workspace's connected Messenger, Instagram and WhatsApp accounts, for people with `inbox.view`. [itemId] opens one
 * conversation, or "setup" the inbox admins' setup.
 */
export function InboxPage({ detail, itemId }: { detail: OrgAdminDetail; itemId: string | null }) {
  const canManage = detail.permissions.effective.includes("inbox.manage");
  if (itemId === "setup" && canManage) return <InboxSetup orgId={detail.org.id} />;
  if (itemId && itemId !== "setup") return <InboxConversationScreen conversationId={itemId} />;
  return <InboxList orgId={detail.org.id} canManage={canManage} />;
}

function InboxList({ orgId, canManage }: { orgId: string; canManage: boolean }) {
  const engine = useEngine();
  const me = useOrbit((s) => s.me?.userId ?? null);
  const rev = useOrbit((s) => s.inboxRev);
  const [view, setView] = useState<InboxView>("all");
  const [provider, setProvider] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [q, setQ] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setQ(typed), SEARCH_DELAY_MS);
    return () => clearTimeout(t);
  }, [typed]);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), REFRESH_MS);
    return () => clearInterval(t);
  }, []);
  const list = useLoad(() => inboxConversations(engine, orgId, { view, provider, q }), [engine, orgId, view, provider, q, rev, tick]);
  const counts = list.data?.counts;
  const countOf = (v: InboxView) => (v === "unassigned" ? counts?.unassigned : v === "mine" ? counts?.mine : v === "ai" ? counts?.escalated : undefined);
  return (
    <div className="ws-page">
      <Card
        title="Customer inbox"
        sub={<NotE2eeNote />}
        actions={
          canManage && (
            <button className="btn btn-secondary btn-sm" onClick={() => navigate({ section: "workspace", workspacePage: "inbox", itemId: "setup" })}>
              <Settings size={14} /> Inbox setup
            </button>
          )
        }
      >
        <label className="ib-search">
          <Search size={15} className="faint" />
          <input className="input" value={typed} maxLength={100} onChange={(e) => setTyped(e.target.value)} placeholder="Search customers and tags" aria-label="Search customers and tags" />
        </label>
        <div className="chips search-filters" role="group" aria-label="View">
          {VIEWS.map((v) => {
            const n = countOf(v);
            return (
              <button key={v} className="chip" aria-selected={view === v} onClick={() => setView(v)}>
                {VIEW_LABEL[v]}
                {n ? ` · ${n}` : ""}
              </button>
            );
          })}
        </div>
        <div className="chips search-filters" role="group" aria-label="Platform">
          <button className="chip" aria-selected={provider === null} onClick={() => setProvider(null)}>
            All platforms
          </button>
          {PROVIDERS.map((p) => (
            <button key={p} className="chip" aria-selected={provider === p} onClick={() => setProvider(p)}>
              {providerBadge(p)}
            </button>
          ))}
        </div>
        <ErrorLine text={list.error} />
        {!list.data && !list.error && <div className="skeleton" style={{ height: 160 }} aria-busy="true" />}
        {list.data?.conversations.length === 0 && (
          <div className="ib-empty">
            <MessagesSquare size={22} className="faint" />
            <strong>No conversations here</strong>
            <small className="faint">New customer messages from connected accounts appear here.</small>
          </div>
        )}
        <ul className="ws-list">
          {(list.data?.conversations ?? []).map((c) => (
            <li key={c.id}>
              <ConversationRow c={c} me={me} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function ConversationRow({ c, me }: { c: InboxConversation; me: string | null }) {
  const assignee = c.assigneeId === null ? "Unassigned" : c.assigneeId === me ? "You" : null;
  const meta = [
    c.account.name,
    assignee,
    c.handling !== "human" ? HANDLING_LABEL[c.handling] : null,
    c.priority !== "normal" ? PRIORITY_LABEL[c.priority] : null,
    c.tags.length ? c.tags.map((t) => `#${t}`).join(" ") : null,
  ].filter(Boolean);
  return (
    <button className="list-row ib-row" onClick={() => navigate({ section: "workspace", workspacePage: "inbox", itemId: c.id })}>
      <span className={`ib-badge ib-${c.provider}`}>{providerBadge(c.provider)}</span>
      <span className="lines grow">
        <strong className={c.unread ? undefined : "ib-read"}>{customerLabel(c)}</strong>
        <small className={`ellipsis ${c.unread ? "" : "faint"}`}>{c.preview || "…"}</small>
        <small className="faint ellipsis">{meta.join(" · ")}</small>
      </span>
      <span className="ib-row-meta">
        <small className="faint">{shortWhen(c.lastMessageAt)}</small>
        {c.overdue ? <small className="danger-text">Overdue</small> : c.unread > 0 ? <span className="count accent">{c.unread}</span> : null}
      </span>
    </button>
  );
}
