import { AtSign, Compass, Hash, Inbox, MessagesSquare, PenSquare, RotateCw, ShieldCheck, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import type { OrgDetail } from "../../api/schemas";
import { shallowEqual, useEngine, useOrbit } from "../../application/orbit";
import { navigate, type Section } from "../../application/router";
import { orgDetail } from "../../sync/account";
import { colorIndexOf } from "../components/Avatar";
import { GroupAvatar, UserAvatar } from "../components/OrgAvatar";
import { conversationTitle, dmPeer, shortWhen } from "../format";
import { byActivity, inWorkspace, isPeople, mentionConversations } from "../selectors";
import type { ShellDialog } from "../shell/Shell";
import { StartChecklist } from "./StartChecklist";
import { DraftsAndSent } from "./DraftsAndSent";
import { GuideCard, OnboardingBanner } from "../community/GuideOnboarding";

function greeting(): string {
  const h = new Date().getHours();
  return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** The selected workspace at a glance (android WorkspaceHomeScreen): what needs you, from real data only. */
export function HomeView({ orgId, section, onDialog }: { orgId: string | null; section: Section; onDialog: (d: ShellDialog) => void }) {
  const engine = useEngine();
  const me = useOrbit((s) => s.me);
  const org = useOrbit((s) => s.orgs.find((o) => o.id === orgId) ?? null);
  const synced = useOrbit((s) => s.synced);
  const communities = useOrbit((s) => s.server?.features.includes("community-channels") ?? false);
  const history = useOrbit((s) => s.history);
  const unread = useOrbit(
    (s) =>
      Object.values(s.conversations)
        .filter((c) => inWorkspace(c, orgId) && (s.local[c.id]?.unread ?? 0) > 0)
        .sort(byActivity(s))
        .map((c) => c.id),
    shallowEqual,
  );
  const mentions = useOrbit((s) => mentionConversations(s, orgId).map((c) => c.id), shallowEqual);
  const recent = useOrbit(
    (s) =>
      Object.values(s.conversations)
        .filter((c) => inWorkspace(c, orgId) && (section !== "dms" || isPeople(c)))
        .sort(byActivity(s))
        .slice(0, 8)
        .map((c) => c.id),
    shallowEqual,
  );
  const [detail, setDetail] = useState<OrgDetail | null>(null);

  useEffect(() => {
    setDetail(null);
    if (!orgId) return;
    orgDetail(engine, orgId)
      .then(setDetail)
      .catch(() => setDetail(null));
  }, [engine, orgId]);

  if (!me) return null;
  return (
    <section className="main" aria-label={section === "dms" ? "Direct messages" : "Home"}>
      <div className="view scroll">
        <div className="view-inner">
          <div>
            <h1>
              {greeting()}, {me.displayName.split(" ")[0]} 👋
            </h1>
            <p className="view-sub">
              {org
                ? `Here's what's happening in ${org.name}.`
                : communities
                  ? "Your direct messages and groups are here. Start a community, find one in Discover, or join one with an invitation code."
                  : "Your direct messages and groups are here. Create a workspace for your team, start a community, or join one with an invitation code."}
            </p>
            {!org && section === "home" && (
              <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button className="btn btn-primary btn-sm" onClick={() => onDialog({ kind: "createWorkspace" })}>
                  {communities ? "Start a community" : "Create a workspace"}
                </button>
                {communities && (
                  <button className="btn btn-secondary btn-sm" onClick={() => onDialog({ kind: "discover" })}>
                    Discover communities
                  </button>
                )}
                <button className="btn btn-secondary btn-sm" onClick={() => onDialog({ kind: "joinWorkspace" })}>
                  Join with a code
                </button>
              </div>
            )}
          </div>

          {section === "home" && orgId && communities && <OnboardingBanner orgId={orgId} />}
          {section === "home" && orgId && communities && <GuideCard orgId={orgId} />}
          {section === "home" && synced && <StartChecklist orgId={orgId} onDialog={onDialog} />}

          {history.status === "running" && (
            <div className="banner info" role="status">
              <RotateCw size={16} />
              <span className="grow">Restoring your encrypted history… {history.restored} messages so far.</span>
            </div>
          )}
          {history.status === "done" && history.restored > 0 && history.unreadable > 0 && (
            <div className="banner warn">
              <span className="grow">{history.unreadable} history items were written under an earlier identity key and can't be read.</span>
            </div>
          )}
          {history.status === "error" && (
            <div className="banner warn">
              <span className="grow">Couldn't restore earlier messages: {history.error}</span>
            </div>
          )}

          <div className="cards">
            <button className="card stat" onClick={() => unread[0] && navigate({ section: "home", conversationId: unread[0] })} disabled={!unread.length}>
              <Inbox size={18} className="faint" />
              <strong>{unread.length}</strong>
              <span>conversations with unread messages</span>
            </button>
            <button className="card stat" onClick={() => navigate({ section: "activity" })}>
              <AtSign size={18} className="faint" />
              <strong>{mentions.length}</strong>
              <span>{mentions.length === 1 ? "conversation mentions you" : "conversations mention you"}</span>
            </button>
            {detail ? (
              <>
                <div className="card stat">
                  <UsersRound size={18} className="faint" />
                  <strong>{detail.stats.members}</strong>
                  <span>members in {detail.org.name}</span>
                </div>
                <button className="card stat" onClick={() => onDialog({ kind: "channels" })}>
                  <Hash size={18} className="faint" />
                  <strong>{detail.stats.channels}</strong>
                  <span>channels · browse and join</span>
                </button>
              </>
            ) : (
              <button className="card stat" onClick={() => onDialog({ kind: "new" })}>
                <PenSquare size={18} className="faint" />
                <strong>New</strong>
                <span>start a direct message</span>
              </button>
            )}
          </div>

          {section === "home" && <DraftsAndSent orgId={orgId} />}

          <div className="card list-card">
            <h2>{section === "dms" ? "Recent direct messages" : "Recent conversations"}</h2>
            {!synced && recent.length === 0 ? (
              <div style={{ padding: 12, display: "grid", gap: 10 }}>
                {[0, 1, 2].map((i) => (
                  <span key={i} className="skeleton" style={{ height: 40 }} />
                ))}
              </div>
            ) : recent.length === 0 ? (
              <div className="empty">
                <span className="empty-orb">
                  <MessagesSquare size={24} />
                </span>
                <h2>No conversations yet</h2>
                <p>Start a direct message, or join a channel in your {communities ? "community" : "workspace"}.</p>
                <div className="row">
                  <button className="btn btn-primary" onClick={() => onDialog({ kind: "new" })}>
                    <PenSquare size={16} /> New message
                  </button>
                  {org && (
                    <button className="btn btn-secondary" onClick={() => onDialog({ kind: "channels" })}>
                      <Compass size={16} /> Browse channels
                    </button>
                  )}
                </div>
              </div>
            ) : (
              recent.map((id) => <RecentRow key={id} id={id} section={section} />)
            )}
          </div>

          <p className="faint row" style={{ fontSize: 12.5, margin: 0, gap: 6 }}>
            <ShieldCheck size={14} /> Messages are end-to-end encrypted. This browser is one of your account's devices; your phone sees everything you send here.
          </p>
        </div>
      </div>
    </section>
  );
}

function RecentRow({ id, section }: { id: string; section: Section }) {
  const row = useOrbit((s) => {
    const c = s.conversations[id];
    if (!c || !s.me) return null;
    const peer = c.type === "DM" ? dmPeer(c, s.me.userId) : null;
    const l = s.local[id];
    return {
      type: c.type,
      title: conversationTitle(c, s.me.userId, s.users),
      color: peer?.avatarColor ?? colorIndexOf(id),
      peerId: peer?.id ?? null,
      // The person's or group's photo, where they have one (the list showed only initials).
      photoRev: peer ? (s.users[peer.id]?.photoRev ?? null) : c.photoRev,
      preview: l?.lastPreview ?? null,
      sender: l?.lastSenderName ?? null,
      at: l?.lastActivityAt ?? 0,
      unread: l?.unread ?? 0,
    };
  }, shallowEqual);
  if (!row) return null;
  return (
    <button className="list-row" onClick={() => navigate({ section: section === "dms" ? "dms" : "home", conversationId: id })}>
      {row.type === "CHANNEL" ? (
        <span className="empty-orb" style={{ width: 36, height: 36 }}>
          <Hash size={16} />
        </span>
      ) : row.peerId ? (
        <UserAvatar userId={row.peerId} name={row.title} colorIndex={row.color} photoRev={row.photoRev} size={36} decorative />
      ) : (
        <GroupAvatar conversationId={id} name={row.title} photoRev={row.photoRev} size={36} />
      )}
      <span className="lines">
        <span className="ellipsis" style={{ fontWeight: row.unread ? 700 : 600 }}>
          {row.type === "CHANNEL" ? `#${row.title}` : row.title}
        </span>
        <small className="ellipsis">{row.preview ? `${row.sender && row.type !== "DM" ? `${row.sender}: ` : ""}${row.preview}` : "No messages on this browser yet"}</small>
      </span>
      <span className="faint" style={{ fontSize: 12 }}>
        {shortWhen(row.at)}
      </span>
      {row.unread > 0 && <span className="count accent">{row.unread}</span>}
    </button>
  );
}
