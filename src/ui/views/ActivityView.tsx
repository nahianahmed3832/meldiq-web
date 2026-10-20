import { AtSign, Building2, Hash, LogIn, LogOut, MailPlus, MessagesSquare, Phone, PhoneMissed, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "../../api/client";
import type { Activity } from "../../api/schemas";
import { shallowEqual, useEngine, useOrbit } from "../../app/orbit";
import { navigate } from "../../app/router";
import { orgActivity } from "../../sync/account";
import type { ThreadActivity } from "../../sync/threads";
import { Avatar, colorIndexOf } from "../components/Avatar";
import { conversationTitle, relative } from "../format";
import { type ActivityFilter, activityShows, mentionConversations } from "../selectors";

/**
 * What needs you (android ActivityFeedScreen): unread @mentions in every workspace (opening the chat clears them), then the
 * selected workspace's change log where the server lets this account see it.
 */
export function ActivityView({ orgId }: { orgId: string | null }) {
  const engine = useEngine();
  const org = useOrbit((s) => s.orgs.find((o) => o.id === orgId) ?? null);
  const mentions = useOrbit(
    (s) =>
      mentionConversations(s, null).map((c) => ({
        id: c.id,
        title: s.me ? conversationTitle(c, s.me.userId, s.users) : "",
        type: c.type,
        count: s.local[c.id]?.mentions ?? 0,
        preview: s.local[c.id]?.lastPreview ?? "",
        at: s.local[c.id]?.lastActivityAt ?? 0,
      })),
    (a, b) => a.length === b.length && a.every((x, i) => shallowEqual(x, b[i])),
  );
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [log, setLog] = useState<Activity[] | null>(null);
  const [logError, setLogError] = useState<string | null>(null);

  useEffect(() => {
    setLog(null);
    setLogError(null);
    if (!orgId) return;
    orgActivity(engine, orgId)
      .then(setLog)
      .catch((e: unknown) => setLogError(e instanceof ApiError && e.status === 403 ? "Guests can't see the workspace's activity." : e instanceof Error ? e.message : "Couldn't load activity."));
  }, [engine, orgId]);

  return (
    <section className="main" aria-label="Activity">
      <div className="view scroll">
        <div className="view-inner">
          <div>
            <h1>Activity</h1>
            <p className="view-sub">Mentions of you, and what changed in {org?.name ?? "your workspace"}.</p>
          </div>
          <div className="search-filters" role="tablist" aria-label="Show">
            {(["all", "mentions", "threads", "calls"] as const).map((f) => (
              <button key={f} role="tab" aria-selected={filter === f} className="chip" onClick={() => setFilter(f)}>
                {{ all: "All", mentions: "Mentions", threads: "Threads", calls: "Calls" }[f]}
              </button>
            ))}
          </div>
          {activityShows(filter, "mentions") && (
            <div className="card list-card">
              <h2>Unread mentions</h2>
              {mentions.length === 0 ? (
                <div className="empty" style={{ padding: 28 }}>
                  <span className="empty-orb">
                    <AtSign size={24} />
                  </span>
                  <p>Nobody has mentioned you since you last read. You're all caught up.</p>
                </div>
              ) : (
                mentions.map((m) => (
                  <button key={m.id} className="list-row" onClick={() => navigate({ section: "activity", conversationId: m.id })}>
                    {m.type === "CHANNEL" ? (
                      <span className="empty-orb" style={{ width: 36, height: 36 }}>
                        <Hash size={16} />
                      </span>
                    ) : (
                      <Avatar name={m.title} colorIndex={colorIndexOf(m.id)} size={36} decorative />
                    )}
                    <span className="lines">
                      <span className="ellipsis" style={{ fontWeight: 700 }}>
                        {m.type === "CHANNEL" ? `#${m.title}` : m.title}
                      </span>
                      <small className="ellipsis">{m.preview}</small>
                    </span>
                    <span className="faint" style={{ fontSize: 12 }}>
                      {relative(m.at)}
                    </span>
                    <span className="count accent">@{m.count}</span>
                  </button>
                ))
              )}
            </div>
          )}
          {activityShows(filter, "calls") && <MissedCalls showEmpty={filter === "calls"} />}
          {activityShows(filter, "threads") && <ThreadReplies />}
          {filter === "all" && orgId && (
            <div className="card list-card">
              <h2>Workspace activity</h2>
              {logError ? (
                <div className="side-quiet" style={{ padding: 14 }}>
                  {logError}
                </div>
              ) : !log ? (
                <div style={{ padding: 12, display: "grid", gap: 10 }} aria-busy="true">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className="skeleton" style={{ height: 36 }} />
                  ))}
                </div>
              ) : log.length === 0 ? (
                <div className="side-quiet" style={{ padding: 14 }}>
                  Nothing has changed here recently.
                </div>
              ) : (
                log.map((a) => <ActivityRow key={a.id} a={a} />)
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** The week's missed calls (android WorkspaceHomeRules.MISSED_CALLS_ACTIVITY_WINDOW_MS), newest first. */
const MISSED_WINDOW_MS = 7 * 86_400_000;

function MissedCalls({ showEmpty = false }: { showEmpty?: boolean }) {
  const missed = useOrbit(
    (s) =>
      s.callLog
        .filter((c) => c.outcome === "missed" && Date.now() - c.at < MISSED_WINDOW_MS && s.conversations[c.conversationId])
        .slice(0, 20)
        .map((c) => ({ ...c, title: s.me ? conversationTitle(s.conversations[c.conversationId], s.me.userId, s.users) : "", by: s.users[c.startedBy]?.displayName ?? "Someone" })),
    (a, b) => JSON.stringify(a) === JSON.stringify(b),
  );
  if (missed.length === 0) {
    // Under the Calls chip (round 3) an empty list says so instead of leaving the page blank.
    if (!showEmpty) return null;
    return (
      <div className="card list-card">
        <h2>Missed calls</h2>
        <div className="side-quiet" style={{ padding: 14 }}>
          No missed calls in the last week.
        </div>
      </div>
    );
  }
  return (
    <div className="card list-card">
      <h2>Missed calls</h2>
      {missed.map((c) => (
        <button key={c.callId} className="list-row" onClick={() => navigate({ section: "activity", conversationId: c.conversationId })}>
          <span className="empty-orb" style={{ width: 36, height: 36, color: "var(--danger)" }}>
            <PhoneMissed size={16} />
          </span>
          <span className="lines">
            <span className="ellipsis" style={{ fontWeight: 700 }}>
              {c.group ? c.title : c.by}
            </span>
            <small className="ellipsis">
              Missed {c.group ? "group " : ""}
              {c.video ? "video" : "voice"} call{c.group ? ` · started by ${c.by}` : ""}
            </small>
          </span>
          <span className="faint" style={{ fontSize: 12 }}>
            {relative(c.at)}
          </span>
        </button>
      ))}
    </div>
  );
}

/** Threads you started or replied in, unseen replies first (android ThreadActivityRules). */
function ThreadReplies() {
  const engine = useEngine();
  const rev = useOrbit((s) => s.threadRev);
  const [threads, setThreads] = useState<ThreadActivity[] | null>(null);
  useEffect(() => {
    let live = true;
    void engine.threadActivity().then((t) => live && setThreads(t));
    return () => {
      live = false;
    };
  }, [engine, rev]);
  const names = useOrbit((s) => s.users);
  const titles = useOrbit(
    (s) =>
      Object.fromEntries((threads ?? []).map((t) => [t.conversationId, s.conversations[t.conversationId] && s.me ? conversationTitle(s.conversations[t.conversationId], s.me.userId, s.users) : ""])),
    (a, b) => JSON.stringify(a) === JSON.stringify(b),
  );
  return (
    <div className="card list-card">
      <h2>Thread replies</h2>
      {!threads ? (
        <div style={{ padding: 12 }} aria-busy="true">
          <span className="skeleton" style={{ height: 36, display: "block" }} />
        </div>
      ) : threads.length === 0 ? (
        <div className="side-quiet" style={{ padding: 14 }}>
          Replies in threads you started or joined show up here.
        </div>
      ) : (
        threads.map((t) => (
          <button key={t.rootId} className="list-row" onClick={() => navigate({ section: "activity", conversationId: t.conversationId, panel: "thread", threadRoot: t.rootId })}>
            <span className="empty-orb" style={{ width: 36, height: 36 }}>
              <MessagesSquare size={16} />
            </span>
            <span className="lines">
              <span className="ellipsis" style={{ fontWeight: t.unseen ? 700 : 500 }}>
                {t.root && !t.root.deleted ? t.root.text || "Attachment" : "A thread"}
              </span>
              <small className="ellipsis">
                {titles[t.conversationId] ? `${titles[t.conversationId]} · ` : ""}
                {t.replies} {t.replies === 1 ? "reply" : "replies"} · last from {names[t.lastReplierId]?.displayName ?? "someone"}
              </small>
            </span>
            <span className="faint" style={{ fontSize: 12 }}>
              {relative(t.lastReplyAt)}
            </span>
            {t.unseen > 0 && <span className="count accent">{t.unseen}</span>}
          </button>
        ))
      )}
    </div>
  );
}

const ACTIONS: Record<string, { text: string; icon: React.ReactNode }> = {
  "org.create": { text: "created the workspace", icon: <Building2 size={16} /> },
  "org.update": { text: "updated the workspace", icon: <Building2 size={16} /> },
  "branch.create": { text: "created a branch", icon: <Building2 size={16} /> },
  "branch.update": { text: "updated a branch", icon: <Building2 size={16} /> },
  "department.create": { text: "created a department", icon: <Building2 size={16} /> },
  "department.update": { text: "updated a department", icon: <Building2 size={16} /> },
  "department.delete": { text: "removed a department", icon: <Building2 size={16} /> },
  "team.create": { text: "created a team", icon: <UsersRound size={16} /> },
  "team.update": { text: "updated a team", icon: <UsersRound size={16} /> },
  "channel.create": { text: "created a channel", icon: <Hash size={16} /> },
  "channel.update": { text: "updated a channel", icon: <Hash size={16} /> },
  "channel.archive": { text: "archived a channel", icon: <Hash size={16} /> },
  "channel.member.add": { text: "added someone to a channel", icon: <Hash size={16} /> },
  "call.start": { text: "started a call", icon: <Phone size={16} /> },
  "invite.create": { text: "created an invitation", icon: <MailPlus size={16} /> },
  "invite.revoke": { text: "revoked an invitation", icon: <MailPlus size={16} /> },
  "invite.accept": { text: "joined the workspace", icon: <LogIn size={16} /> },
  "member.role": { text: "changed someone's role", icon: <UsersRound size={16} /> },
  "member.leave": { text: "left the workspace", icon: <LogOut size={16} /> },
  "member.remove": { text: "removed someone from the workspace", icon: <LogOut size={16} /> },
  "org.photo": { text: "changed the workspace photo", icon: <Building2 size={16} /> },
  "branch.archive": { text: "archived a branch", icon: <Building2 size={16} /> },
  "branch.restore": { text: "restored a branch", icon: <Building2 size={16} /> },
  "team.archive": { text: "archived a team", icon: <UsersRound size={16} /> },
  "team.restore": { text: "restored a team", icon: <UsersRound size={16} /> },
  "channel.access": { text: "changed who can use a channel", icon: <Hash size={16} /> },
  "channel.restore": { text: "restored a channel", icon: <Hash size={16} /> },
};

function ActivityRow({ a }: { a: Activity }) {
  const known = ACTIONS[a.action] ?? { text: "made a change", icon: <AtSign size={16} /> };
  const target = useOrbit((s) => (a.target && s.conversations[a.target] && s.me ? conversationTitle(s.conversations[a.target], s.me.userId, s.users) : null));
  return (
    <div className="list-row">
      <span className="empty-orb" style={{ width: 34, height: 34 }}>
        {known.icon}
      </span>
      <span className="lines">
        <span className="ellipsis">
          <b>{a.actorName ?? "Someone"}</b> {known.text}
          {target ? (
            <>
              {" "}
              <a href={`#/activity/c/${encodeURIComponent(a.target!)}`}>#{target}</a>
            </>
          ) : null}
        </span>
        <small>{relative(a.at)}</small>
      </span>
    </div>
  );
}
