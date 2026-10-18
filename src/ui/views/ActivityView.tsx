import { AtSign, Building2, Hash, LogIn, LogOut, MailPlus, Phone, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "../../api/client";
import type { Activity } from "../../api/schemas";
import { shallowEqual, useEngine, useOrbit } from "../../app/orbit";
import { navigate } from "../../app/router";
import { orgActivity } from "../../sync/account";
import { Avatar, colorIndexOf } from "../components/Avatar";
import { conversationTitle, relative } from "../format";
import { mentionConversations } from "../selectors";

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
          {orgId && (
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
