import { RecentActivity } from "../experience/RecentActivity";
import { conversationPreview } from "../../sync/rules";
import { countLabel } from "../../i18n/counts";
import { formatUiNumber } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { MeldlingArt } from "../components/MeldlingArt";
import { AtSign, Building2, Hash, LogIn, LogOut, MailPlus, MessagesSquare, Phone, PhoneMissed, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "../../api/client";
import type { Activity } from "../../api/schemas";
import { shallowEqual, useEngine, useOrbit } from "../../application/orbit";
import { navigate, routeHref } from "../../application/router";
import { orgActivity } from "../../sync/account";
import type { ThreadActivity } from "../../sync/threads";
import { Avatar, colorIndexOf } from "../components/Avatar";
import { conversationTitle, relative } from "../format";
import { type ActivityFilter, activityShows, mentionConversations, unreadGroups } from "../selectors";
/**
 * What needs you (android ActivityFeedScreen): unread @mentions in every workspace (opening the chat clears them), then the
 * selected workspace's change log where the server lets this account see it.
 */
export function ActivityView({ orgId }: { orgId: string | null }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const org = useOrbit((s) => s.orgs.find((o) => o.id === orgId) ?? null);
  const mentions = useOrbit(
    (s) =>
      mentionConversations(s, null).map((c) => ({
        id: c.id,
        title: s.me ? conversationTitle(c, s.me.userId, s.users) : "",
        type: c.type,
        count: s.local[c.id]?.mentions ?? 0,
        preview: conversationPreview(s.local[c.id]) ?? "",
        at: s.local[c.id]?.lastActivityAt ?? 0,
      })),
    (a, b) => a.length === b.length && a.every((x, i) => shallowEqual(x, b[i])),
  );
  const [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [log, setLog] = useState<Activity[] | null>(null);
  const [logError, setLogError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setLog(null);
    setLogError(null);
    if (!orgId) return;
    orgActivity(engine, orgId)
      .then((value) => {
        if (alive) setLog(value);
      })
      .catch(
        (e: unknown) =>
          alive &&
          setLogError(
            e instanceof ApiError && e.status === 403
              ? uiText("workspace.interface.guests_can_t_see_the_community_s_activity_a93c663")
              : e instanceof Error
                ? e.message
                : uiText("workspace.interface.couldn_t_load_activity_0b66256"),
          ),
      );
    return () => {
      alive = false;
    };
  }, [engine, orgId, retry]);
  return (
    <section className="main" aria-label={l10n("workspace.activity")}>
      <div className="view scroll">
        <div className="view-inner">
          <div>
            <h1>{l10n("workspace.activity")}</h1>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate({ section: "settings", settingsPage: "notifications" })}>
              {l10n("notifications.bell_label")}
            </button>
            <p className="view-sub">
              <Localized k="workspace.interface.mentions_of_you_and_what_changed_in_ca03e80" slots={[org?.name ?? uiText("workspace.interface.your_community_77cfb84")]} />
            </p>
          </div>
          <RecentActivity />
          <div className="search-filters" role="tablist" aria-label={uiText("messaging.interface.show_0df6f1c")}>
            {(["all", "mentions", "unreads", "threads", "calls"] as const).map((f) => (
              <button key={f} role="tab" aria-selected={filter === f} className="chip" onClick={() => setFilter(f)}>
                {
                  {
                    all: uiText("settings.ap_all"),
                    mentions: uiText("workspace.side_mentions"),
                    unreads: uiText("workspace.side_unreads"),
                    threads: uiText("messaging.interface.threads_3e42e38"),
                    calls: uiText("settings.interface.calls_b73a5e2"),
                  }[f]
                }
              </button>
            ))}
          </div>
          {activityShows(filter, "unreads") && <Unreads />}
          {activityShows(filter, "mentions") && (
            <div className="card list-card">
              <h2>
                <Localized k="workspace.interface.unread_mentions_201289d" />
              </h2>
              {mentions.length === 0 ? (
                <div className="empty" style={{ padding: 28 }}>
                  <MeldlingArt pose="all-set" />
                  <p>
                    <Localized k="workspace.interface.nobody_has_mentioned_you_since_you_last_read_you_re_all_caught_up_7c245a8" />
                  </p>
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
                        {m.type === "CHANNEL" ? uiText("messaging.interface.value0_dbac6f0", { value0: m.title }) : m.title}
                      </span>
                      <small className="ellipsis">{m.preview}</small>
                    </span>
                    <span className="faint" style={{ fontSize: 12 }}>
                      {relative(m.at)}
                    </span>
                    <span className="count accent">@{formatUiNumber(m.count)}</span>
                  </button>
                ))
              )}
            </div>
          )}
          {activityShows(filter, "calls") && <MissedCalls showEmpty={filter === "calls"} />}
          {activityShows(filter, "threads") && <ThreadReplies />}
          {filter === "all" && orgId && (
            <div className="card list-card">
              <h2>
                <Localized k="workspace.interface.community_activity_6b03fb2" />
              </h2>
              {logError ? (
                <div className="side-quiet" role="alert" style={{ padding: 14 }}>
                  {logError}
                  <button className="btn btn-secondary btn-sm" onClick={() => setRetry((n) => n + 1)}>
                    {l10n("common.actions.retry")}
                  </button>
                </div>
              ) : !log ? (
                <div style={{ padding: 12, display: "grid", gap: 10 }} aria-busy="true">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className="skeleton" style={{ height: 36 }} />
                  ))}
                </div>
              ) : log.length === 0 ? (
                <div className="side-quiet" style={{ padding: 14 }}>
                  <Localized k="workspace.interface.nothing_has_changed_here_recently_3636a86" />
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
const MISSED_WINDOW_MS = 7 * 86400000;
function MissedCalls({ showEmpty = false }: { showEmpty?: boolean }) {
  useLocaleRender();
  const missed = useOrbit(
    (s) =>
      s.callLog
        .filter((c) => c.outcome === "missed" && Date.now() - c.at < MISSED_WINDOW_MS && s.conversations[c.conversationId])
        .slice(0, 20)
        .map((c) => ({
          ...c,
          title: s.me ? conversationTitle(s.conversations[c.conversationId], s.me.userId, s.users) : "",
          by: s.users[c.startedBy]?.displayName ?? uiText("messaging.react_someone"),
        })),
    (a, b) => JSON.stringify(a) === JSON.stringify(b),
  );
  if (missed.length === 0) {
    // Under the Calls chip (round 3) an empty list says so instead of leaving the page blank.
    if (!showEmpty) return null;
    return (
      <div className="card list-card">
        <h2>
          <Localized k="workspace.interface.missed_calls_42f59e0" />
        </h2>
        <div className="side-quiet" style={{ padding: 14 }}>
          <Localized k="workspace.interface.no_missed_calls_in_the_last_week_281b541" />
        </div>
      </div>
    );
  }
  return (
    <div className="card list-card">
      <h2>
        <Localized k="workspace.interface.missed_calls_42f59e0" />
      </h2>
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
              <Localized
                k="workspace.interface.missed_call_cf524e9"
                slots={[
                  c.group ? uiText("workspace.interface.group_9f1e4c1") : "",
                  c.video ? uiText("workspace.interface.video_0cab1c9") : uiText("workspace.interface.voice_c57d7e9"),
                  c.group ? uiText("workspace.interface.started_by_value0_18bcc64", { value0: c.by }) : "",
                ]}
              />
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
  useLocaleRender();
  const engine = useEngine();
  const rev = useOrbit((s) => s.threadRev);
  const conversations = useOrbit((s) => s.conversations);
  const [retry, setRetry] = useState(0),
    [error, setError] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadActivity[] | null>(null);
  useEffect(() => {
    let live = true;
    setError(null);
    void engine
      .threadActivity()
      .then((t) => live && setThreads(t))
      .catch((e) => live && setError(e instanceof Error ? e.message : uiText("workspace.interface.couldn_t_load_activity_0b66256")));
    return () => {
      live = false;
    };
  }, [engine, rev, conversations, retry]);
  const names = useOrbit((s) => s.users);
  const titles = useOrbit(
    (s) =>
      Object.fromEntries((threads ?? []).map((t) => [t.conversationId, s.conversations[t.conversationId] && s.me ? conversationTitle(s.conversations[t.conversationId], s.me.userId, s.users) : ""])),
    (a, b) => JSON.stringify(a) === JSON.stringify(b),
  );
  return (
    <div className="card list-card">
      <h2>
        <Localized k="workspace.interface.thread_replies_fcf8b34" />
      </h2>
      {error ? (
        <div role="alert">
          {error}
          <button className="btn btn-secondary btn-sm" onClick={() => setRetry((n) => n + 1)}>
            {uiText("common.actions.retry")}
          </button>
        </div>
      ) : !threads ? (
        <div style={{ padding: 12 }} aria-busy="true">
          <span className="skeleton" style={{ height: 36, display: "block" }} />
        </div>
      ) : threads.length === 0 ? (
        <div className="side-quiet" style={{ padding: 14 }}>
          <Localized k="workspace.interface.replies_in_threads_you_started_or_joined_show_up_here_3dd8a18" />
        </div>
      ) : (
        threads.map((t) => (
          <button key={t.rootId} className="list-row" onClick={() => navigate({ section: "activity", conversationId: t.conversationId, panel: "thread", threadRoot: t.rootId })}>
            <span className="empty-orb" style={{ width: 36, height: 36 }}>
              <MessagesSquare size={16} />
            </span>
            <span className="lines">
              <span className="ellipsis" style={{ fontWeight: t.unseen ? 700 : 500 }}>
                {t.root && !t.root.deleted ? t.root.text || uiText("messaging.interface.attachment_040d2b3") : uiText("workspace.interface.a_thread_dc6d18e")}
              </span>
              <small className="ellipsis">
                <Localized
                  k="workspace.interface.native_count_3ef18cb9f"
                  slots={[
                    titles[t.conversationId] ? uiText("workspace.interface.value0_3122394", { value0: titles[t.conversationId] }) : "",
                    countLabel(t.replies, "replies"),
                    "",
                    names[t.lastReplierId]?.displayName ?? uiText("workspace.interface.someone_2a59d59"),
                  ]}
                />
              </small>
            </span>
            <span className="faint" style={{ fontSize: 12 }}>
              {relative(t.lastReplyAt)}
            </span>
            {t.unseen > 0 && <span className="count accent">{formatUiNumber(t.unseen)}</span>}
          </button>
        ))
      )}
    </div>
  );
}
const ACTIONS: Record<
  string,
  {
    text: string;
    icon: React.ReactNode;
  }
> = {
  "org.create": {
    get text() {
      return uiText("workspace.interface.created_the_community_e99af15");
    },
    icon: <Building2 size={16} />,
  },
  "org.update": {
    get text() {
      return uiText("workspace.interface.updated_the_community_b54e180");
    },
    icon: <Building2 size={16} />,
  },
  "branch.create": {
    get text() {
      return uiText("workspace.interface.created_a_branch_4d0b903");
    },
    icon: <Building2 size={16} />,
  },
  "branch.update": {
    get text() {
      return uiText("workspace.interface.updated_a_branch_20dac8f");
    },
    icon: <Building2 size={16} />,
  },
  "department.create": {
    get text() {
      return uiText("workspace.interface.created_a_department_41af0ac");
    },
    icon: <Building2 size={16} />,
  },
  "department.update": {
    get text() {
      return uiText("workspace.interface.updated_a_department_9264baa");
    },
    icon: <Building2 size={16} />,
  },
  "department.delete": {
    get text() {
      return uiText("workspace.interface.removed_a_department_e9afb31");
    },
    icon: <Building2 size={16} />,
  },
  "team.create": {
    get text() {
      return uiText("workspace.interface.created_a_team_94339bb");
    },
    icon: <UsersRound size={16} />,
  },
  "team.update": {
    get text() {
      return uiText("workspace.interface.updated_a_team_33a3ee5");
    },
    icon: <UsersRound size={16} />,
  },
  "channel.create": {
    get text() {
      return uiText("workspace.interface.created_a_channel_bedde6f");
    },
    icon: <Hash size={16} />,
  },
  "channel.update": {
    get text() {
      return uiText("workspace.interface.updated_a_channel_31d30f8");
    },
    icon: <Hash size={16} />,
  },
  "channel.archive": {
    get text() {
      return uiText("workspace.interface.archived_a_channel_36f4f37");
    },
    icon: <Hash size={16} />,
  },
  "channel.member.add": {
    get text() {
      return uiText("workspace.interface.added_someone_to_a_channel_afdb643");
    },
    icon: <Hash size={16} />,
  },
  "call.start": {
    get text() {
      return uiText("workspace.interface.started_a_call_667a9bb");
    },
    icon: <Phone size={16} />,
  },
  "invite.create": {
    get text() {
      return uiText("workspace.interface.created_an_invitation_7e8b60d");
    },
    icon: <MailPlus size={16} />,
  },
  "invite.revoke": {
    get text() {
      return uiText("workspace.interface.revoked_an_invitation_536fdff");
    },
    icon: <MailPlus size={16} />,
  },
  "invite.accept": {
    get text() {
      return uiText("workspace.interface.joined_the_community_6344989");
    },
    icon: <LogIn size={16} />,
  },
  "member.role": {
    get text() {
      return uiText("workspace.interface.changed_someone_s_role_5de5559");
    },
    icon: <UsersRound size={16} />,
  },
  "member.leave": {
    get text() {
      return uiText("workspace.interface.left_the_community_a5957ed");
    },
    icon: <LogOut size={16} />,
  },
  "member.remove": {
    get text() {
      return uiText("workspace.interface.removed_someone_from_the_community_f6bd3ec");
    },
    icon: <LogOut size={16} />,
  },
  "org.photo": {
    get text() {
      return uiText("workspace.interface.changed_the_community_photo_46de4ac");
    },
    icon: <Building2 size={16} />,
  },
  "branch.archive": {
    get text() {
      return uiText("workspace.interface.archived_a_branch_daf6323");
    },
    icon: <Building2 size={16} />,
  },
  "branch.restore": {
    get text() {
      return uiText("workspace.interface.restored_a_branch_bf46f1d");
    },
    icon: <Building2 size={16} />,
  },
  "team.archive": {
    get text() {
      return uiText("workspace.interface.archived_a_team_69a2ba0");
    },
    icon: <UsersRound size={16} />,
  },
  "team.restore": {
    get text() {
      return uiText("workspace.interface.restored_a_team_b7c3d82");
    },
    icon: <UsersRound size={16} />,
  },
  "channel.access": {
    get text() {
      return uiText("workspace.interface.changed_who_can_use_a_channel_015c1b1");
    },
    icon: <Hash size={16} />,
  },
  "channel.restore": {
    get text() {
      return uiText("workspace.interface.restored_a_channel_3f4afd0");
    },
    icon: <Hash size={16} />,
  },
};
function ActivityRow({ a }: { a: Activity }) {
  useLocaleRender();
  const l10n = useLocalization();
  const known = ACTIONS[a.action] ?? {
    get text() {
      return uiText("workspace.interface.made_a_change_b859b99");
    },
    icon: <AtSign size={16} />,
  };
  const target = useOrbit((s) => (a.target && s.conversations[a.target] && s.me ? conversationTitle(s.conversations[a.target], s.me.userId, s.users) : null));
  return (
    <div className="list-row">
      <span className="empty-orb" style={{ width: 34, height: 34 }}>
        {known.icon}
      </span>
      <span className="lines">
        <span className="ellipsis">
          <b>{a.actorName ?? l10n("messaging.react_someone")}</b> {known.text}
          {target ? (
            <>
              {" "}
              <a href={routeHref({ section: "activity", conversationId: a.target })}>#{target}</a>
            </>
          ) : null}
        </span>
        <small>{relative(a.at)}</small>
      </span>
    </div>
  );
}
/** Activity › Unreads (batch B5): by DMs and groups, then each community; Mark as read per row, and Mark all read. */
function Unreads() {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const groups = useOrbit(unreadGroups, (a, b) => JSON.stringify(a) === JSON.stringify(b));
  const rows = useOrbit(
    (s) =>
      Object.fromEntries(
        groups
          .flatMap((g) => g.ids)
          .map((id) => {
            const c = s.conversations[id];
            return [
              id,
              { title: c && s.me ? conversationTitle(c, s.me.userId, s.users) : "", type: c?.type ?? "DM", count: s.local[id]?.unread ?? 0, preview: conversationPreview(s.local[id]) ?? "" },
            ];
          }),
      ),
    (a, b) => JSON.stringify(a) === JSON.stringify(b),
  );
  const all = groups.flatMap((g) => g.ids);
  return (
    <div className="card list-card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2>{l10n("workspace.side_unreads")}</h2>
        {all.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => void Promise.all(all.map((id) => engine.markRead(id)))}>
            <Localized k="workspace.interface.mark_all_read_3bc62a9" />
          </button>
        )}
      </div>
      {groups.length === 0 ? (
        <div className="empty" style={{ padding: 28 }}>
          <p>
            <Localized k="workspace.interface.all_caught_up_6a3f6e4" />
          </p>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.orgId ?? "direct"} aria-label={g.title}>
            <h3 className="ws-subhead" style={{ padding: "0 12px" }}>
              {g.title}
            </h3>
            {g.ids.map((id) => {
              const r = rows[id];
              if (!r) return null;
              return (
                <div key={id} className="list-row">
                  <button className="lines grow" style={{ textAlign: "start" }} onClick={() => navigate({ section: r.type === "CHANNEL" ? "home" : "dms", conversationId: id })}>
                    <span className="ellipsis" style={{ fontWeight: 700 }}>
                      {r.type === "CHANNEL" ? uiText("messaging.interface.value0_dbac6f0", { value0: r.title }) : r.title}
                    </span>
                    <small className="ellipsis">{r.preview}</small>
                  </button>
                  <span className="count accent">{formatUiNumber(r.count)}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => void engine.markRead(id)}>
                    {l10n("notifications.markRead")}
                  </button>
                </div>
              );
            })}
          </section>
        ))
      )}
    </div>
  );
}
