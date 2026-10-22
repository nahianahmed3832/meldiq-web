import { BellOff, Fingerprint, Hash, Images, Lock, LogOut, MessageSquare, ShieldCheck, UsersRound, X } from "lucide-react";
import { titleOf } from "../../sync/forumRules";
import { ThreadsPanel } from "./ThreadsPanel";
import { GroupPhotoCard } from "../people/GroupPhotoCard";
import { openProfile } from "../people/ProfileDialog";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Member } from "../../api/schemas";
import { useEngine, useOrbit } from "../../app/orbit";
import { navigate, type Route } from "../../app/router";
import { safetyNumber } from "../../crypto/identity";
import type { StoredMessage } from "../../model/types";
import { conversationMembers, startDirect, userProfile } from "../../sync/account";
import { Avatar } from "../components/Avatar";
import { conversationTitle, dmPeer, dayLabel } from "../format";
import { levelOf, type NotifyLevel, workspaceOf } from "../../sync/navPrefs";
import { removeConversationMember } from "../../sync/workspaces";
import { Composer } from "./Composer";
import { AddMembersButton, BlockToggle, EditConversationButton } from "./ConversationManage";
import { galleryOf, linksOf } from "./gallery";
import { DetailsTabBar, type DetailsTab, FilesTab, LinksTab, MediaTab, PinsTab } from "./DetailsTabs";
import { NewGroupDialog } from "../dialogs/NewGroupDialog";
import { usePinned } from "./PinnedPanel";
import { MediaGalleryDialog } from "./MediaGalleryDialog";
import { MessageList } from "./MessageList";
import { SearchPanel } from "./SearchPanel";
import { PinnedPanel } from "./PinnedPanel";

export function SidePanel({ route }: { route: Route }) {
  const close = () => navigate({ section: route.section, conversationId: route.conversationId });
  if (!route.conversationId) return null;
  if (route.panel === "search") return <SearchPanel conversationId={route.conversationId} onClose={close} />;
  if (route.panel === "pinned") return <PinnedPanel conversationId={route.conversationId} onClose={close} />;
  if (route.panel === "threads") return <ThreadsPanel conversationId={route.conversationId} section={route.section} onClose={close} />;
  return route.panel === "thread" && route.threadRoot ? (
    <ThreadPanel conversationId={route.conversationId} root={route.threadRoot} onClose={close} />
  ) : (
    <DetailsPanel conversationId={route.conversationId} onClose={close} />
  );
}

function PanelHead({ title, sub, onClose, actions }: { title: string; sub?: string; onClose: () => void; actions?: React.ReactNode }) {
  return (
    <div className="panel-head">
      <div className="grow" style={{ minWidth: 0 }}>
        <h2 className="ellipsis">{title}</h2>
        {sub && <small className="ellipsis">{sub}</small>}
      </div>
      {actions}
      <button className="icon-btn" onClick={onClose} aria-label="Close panel">
        <X size={18} />
      </button>
    </div>
  );
}

function DetailsPanel({ conversationId, onClose }: { conversationId: string; onClose: () => void }) {
  const engine = useEngine();
  const c = useOrbit((s) => s.conversations[conversationId]);
  const me = useOrbit((s) => s.me);
  const users = useOrbit((s) => s.users);
  const loaded = useOrbit((s) => s.messages[conversationId]?.items);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [safety, setSafety] = useState<string | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [tab, setTab] = useState<DetailsTab>("about");
  const [newGroup, setNewGroup] = useState(false);
  const pinnedCount = usePinned(conversationId).length;
  const peer = c && me && c.type === "DM" ? dmPeer(c, me.userId) : null;
  const memberCount = c?.memberCount;

  const loadMembers = useCallback(() => {
    conversationMembers(engine, conversationId)
      .then(setMembers)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't load members"));
  }, [engine, conversationId]);

  useEffect(() => {
    setMembers(null);
    loadMembers();
    // memberCount: someone added or removed (here or on another device) reloads the list.
  }, [loadMembers, memberCount]);

  const gallery = useMemo(() => galleryOf(loaded ?? []), [loaded]);
  const links = useMemo(() => linksOf(loaded ?? []), [loaded]);
  const memberIds = useMemo(() => new Set((members ?? []).map((m) => m.id)), [members]);

  useEffect(() => {
    if (!peer || !me) return;
    let alive = true;
    void (async () => {
      const pin = await engine.pinnedIdentity(peer.id);
      const key = pin?.identityKey ?? (await userProfile(engine, peer.id)).identityKey;
      if (!alive) return;
      setSafety(await safetyNumber(me.identityKey, key));
      setVerified(pin?.verified ?? false);
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [engine, peer, me]);

  if (!c || !me) return null;
  const title = conversationTitle(c, me.userId, users);
  const senderName = (i: { outgoing: boolean; senderUserId: string }) => (i.outgoing ? "You" : (users[i.senderUserId]?.displayName ?? "Unknown"));
  // Batch B14: a direct message or group opens a details page with tabs; a channel keeps its single page.
  const tabbed = c.type !== "CHANNEL";
  const show = (t: DetailsTab) => !tabbed || tab === t;
  const peerMember = peer && members?.find((m) => m.id === peer.id);

  return (
    <aside className="panel" aria-label="Details">
      <PanelHead title="Details" sub={c.type === "CHANNEL" ? `#${title}` : title} onClose={onClose} />
      {tabbed && <DetailsTabBar tab={tab} onTab={setTab} counts={{ members: c.memberCount, media: gallery.media.length, pins: pinnedCount, links: links.length, files: gallery.files.length }} />}
      <div className="panel-body scroll" key={tab}>
        {show("about") && (
          <>
            <div className="panel-card">
              <dl style={{ margin: 0 }}>
                {c.type === "CHANNEL" && (
                  <div>
                    <dt>Topic</dt>
                    <dd>{c.topic ?? <span className="faint">No topic</span>}</dd>
                  </div>
                )}
                <div>
                  <dt>Type</dt>
                  <dd className="row" style={{ gap: 6 }}>
                    {c.type === "CHANNEL" ? c.kind === "PRIVATE" ? <Lock size={14} /> : <Hash size={14} /> : <MessageSquare size={14} />}
                    {c.type === "CHANNEL"
                      ? `${c.kind === "PRIVATE" ? "Private" : c.kind === "ANNOUNCEMENT" ? "Announcement" : "Public"} channel${c.scopeName ? ` in ${c.scopeName}` : ""}`
                      : c.type === "GROUP"
                        ? "Group"
                        : "Direct message"}
                  </dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{dayLabel(c.createdAt)}</dd>
                </div>
                <div>
                  <dt>Encryption</dt>
                  <dd className="row" style={{ gap: 6 }}>
                    <ShieldCheck size={14} /> End-to-end encrypted on your devices
                  </dd>
                </div>
              </dl>
              {c.type !== "DM" && c.canManage && (
                <div>
                  <EditConversationButton c={c} />
                </div>
              )}
            </div>

            {peer && safety && (
              <div className="panel-card">
                <div style={{ display: "grid", gap: 8 }}>
                  <div className="panel-section-title">
                    <span className="row" style={{ gap: 6 }}>
                      <Fingerprint size={14} /> Safety number
                    </span>
                    {verified ? <span className="tag ok">Verified</span> : <span className="tag">Not verified</span>}
                  </div>
                  <span className="fingerprint" style={{ fontSize: 13, whiteSpace: "pre-line" }}>
                    {safety}
                  </span>
                  <span className="faint" style={{ fontSize: 12 }}>
                    Compare it with {peer.displayName} in person or on a call. If it matches on both screens, nobody is in between.
                  </span>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      void engine.markVerified(peer.id, !verified).then(() => setVerified(!verified));
                    }}
                  >
                    {verified ? "Clear verified" : "Mark as verified"}
                  </button>
                </div>
              </div>
            )}

            {peer && (
              <div className="panel-card">
                <div>
                  <BlockToggle userId={peer.id} name={peer.displayName} />
                </div>
              </div>
            )}

            <GroupPhotoCard c={c} title={c.name ?? "Group"} />
          </>
        )}
        {show("members") && (
          <div style={{ display: "grid", gap: 4 }}>
            <div className="panel-section-title">
              <span>Members</span>
              <span>{c.memberCount}</span>
            </div>
            {c.type !== "DM" && <AddMembersButton c={c} memberIds={memberIds} onAdded={loadMembers} />}
            {c.type === "DM" && peerMember && (
              <button className="panel-action-row" onClick={() => setNewGroup(true)}>
                <span className="circle">
                  <UsersRound size={16} />
                </span>
                <span className="lines grow">
                  <span>New group with {peerMember.displayName}</span>
                  <small>Start a group; this conversation stays as it is</small>
                </span>
              </button>
            )}
            {newGroup && peerMember && <NewGroupDialog initial={[peerMember]} onClose={() => setNewGroup(false)} />}
            {error && <div className="banner danger">{error}</div>}
            {!members && !error && <span className="skeleton" style={{ height: 120 }} />}
            {members?.map((m) => (
              <div key={m.id} className="person">
                <Avatar name={m.displayName} colorIndex={m.avatarColor} size={32} online={m.online} presence={m.presence} decorative />
                <div className="lines grow">
                  <button className="ellipsis person-name" onClick={() => openProfile(m.id, m.displayName)}>
                    {m.displayName}
                    {m.id === me.userId ? " (you)" : ""}
                  </button>
                  <small className="ellipsis">
                    @{m.username}
                    {m.role === "ADMIN" ? " · admin" : ""}
                    {m.orgRole && m.orgRole !== "MEMBER" ? ` · ${m.orgRole.toLowerCase()}` : ""}
                  </small>
                </div>
                {m.id !== me.userId && (
                  <button
                    className="icon-btn"
                    aria-label={`Message ${m.displayName}`}
                    onClick={() => {
                      void startDirect(engine, m.id)
                        .then((cid) => navigate({ section: "dms", conversationId: cid }))
                        .catch((e: unknown) => engine.notice("error", e instanceof Error ? e.message : "Couldn't open the conversation"));
                    }}
                  >
                    <MessageSquare size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {tabbed && tab === "media" && <MediaTab gallery={gallery} nameOf={senderName} />}
        {tabbed && tab === "files" && <FilesTab gallery={gallery} nameOf={senderName} />}
        {tabbed && tab === "pins" && <PinsTab conversationId={conversationId} />}
        {tabbed && tab === "links" && <LinksTab conversationId={conversationId} links={links} nameOf={senderName} />}

        {!tabbed && (
          <button className="panel-action-row" onClick={() => setGalleryOpen(true)}>
            <span className="circle">
              <Images size={16} />
            </span>
            <span className="lines grow">
              <span>Media and files</span>
              <small>
                {gallery.media.length} photos and videos · {gallery.files.length} files
              </small>
            </span>
          </button>
        )}
        {galleryOpen && <MediaGalleryDialog gallery={gallery} nameOf={senderName} onClose={() => setGalleryOpen(false)} />}

        {show("about") && <ConversationSettings conversationId={conversationId} />}
      </div>
    </aside>
  );
}

const LEVELS: { level: NotifyLevel; label: string }[] = [
  { level: "all", label: "All new messages" },
  { level: "mentions", label: "Mentions only" },
  { level: "none", label: "Off" },
];

/** Notifications (synced to every device of the person) and leaving the group or channel. */
function ConversationSettings({ conversationId }: { conversationId: string }) {
  const engine = useEngine();
  const c = useOrbit((s) => s.conversations[conversationId]);
  const level = useOrbit((s) => levelOf(s.nav[workspaceOf(c?.orgId ?? null)], conversationId, c?.categoryId ?? null));
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!c) return null;
  const leavable = c.type === "GROUP" || (c.type === "CHANNEL" && !(c.kind === "ANNOUNCEMENT" && !c.canManage));
  const leave = async () => {
    try {
      await removeConversationMember(engine, conversationId, engine.device.userId);
      await engine.refreshAll();
      navigate({ section: c.type === "CHANNEL" ? "home" : "dms" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't leave.");
    }
  };
  return (
    <div className="panel-card" style={{ display: "grid", gap: 10 }}>
      <label className="field">
        <span className="panel-section-title">
          <span className="row" style={{ gap: 6 }}>
            <BellOff size={14} /> Notifications
          </span>
        </span>
        <select className="input input-sm" value={level} onChange={(e) => void engine.arrange(conversationId, { op: "notify", conversationId, level: e.target.value as NotifyLevel })}>
          {LEVELS.map((l) => (
            <option key={l.level} value={l.level}>
              {l.label}
            </option>
          ))}
        </select>
        <span className="hint">Applies on all your devices. A mention of you still notifies when they're off.</span>
      </label>
      {leavable && (
        <>
          {error && (
            <div className="banner danger" role="alert">
              {error}
            </div>
          )}
          {confirm ? (
            <div className="row" style={{ gap: 8 }}>
              <span className="grow">Leave {c.type === "GROUP" ? "this group" : "this channel"}?</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirm(false)}>
                Cancel
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => void leave()}>
                Leave
              </button>
            </div>
          ) : (
            <button className="btn btn-danger-quiet btn-sm" style={{ justifySelf: "start" }} onClick={() => setConfirm(true)}>
              <LogOut size={14} /> Leave {c.type === "GROUP" ? "group" : "channel"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function ThreadPanel({ conversationId, root, onClose }: { conversationId: string; root: string; onClose: () => void }) {
  const engine = useEngine();
  const c = useOrbit((s) => s.conversations[conversationId]);
  const loaded = useOrbit((s) => s.messages[conversationId]?.items);
  const me = useOrbit((s) => s.me);
  const users = useOrbit((s) => s.users);
  // An older post or thread (beyond the conversation's loaded page) comes from this browser's store.
  const [older, setOlder] = useState<StoredMessage[]>([]);
  const inLoaded = !!loaded?.some((m) => m.id === root);
  useEffect(() => {
    if (inLoaded) return setOlder([]);
    let alive = true;
    void engine.conversationMessages(conversationId, 5000).then((list) => alive && setOlder(list.filter((m) => m.id === root || m.threadRootId === root)));
    return () => {
      alive = false;
    };
  }, [engine, conversationId, root, inLoaded]);
  const items = useMemo(() => {
    const byId = new Map(older.map((m) => [m.id, m]));
    for (const m of loaded ?? []) byId.set(m.id, m);
    return [...byId.values()].sort((a, b) => a.sortTs - b.sortTs);
  }, [loaded, older]);
  const rootMsg: StoredMessage | undefined = items.find((m) => m.id === root);
  const replies = items.filter((m) => m.threadRootId === root).length;
  const [following, setFollowing] = useState<boolean | null>(null);
  useEffect(() => {
    void engine.isFollowed(root).then(setFollowing);
  }, [engine, root]);
  // Looking at the thread sees its replies (Activity › Thread replies), including ones that arrive while it's open.
  useEffect(() => {
    void engine.markThreadSeen(root);
  }, [engine, root, replies]);
  if (!c || !me) return null;
  const title = conversationTitle(c, me.userId, users);
  const postTitle = c.format === "forum" && rootMsg ? titleOf(rootMsg.rich?.title, rootMsg.text) : null;
  return (
    <aside className="panel" aria-label="Thread">
      <PanelHead
        title={postTitle || "Thread"}
        sub={c.type === "CHANNEL" ? `#${title}` : title}
        onClose={onClose}
        actions={
          following !== null && (
            <button className="btn btn-secondary btn-sm" aria-pressed={following} onClick={() => void engine.setFollowed(root, !following).then(() => setFollowing(!following))}>
              {following ? "Following" : "Follow"}
            </button>
          )
        }
      />
      {rootMsg ? (
        <>
          <MessageList
            conversationId={conversationId}
            items={items}
            hasMore={false}
            onLoadOlder={() => undefined}
            threadRoot={root}
            canPost={c.canPost}
            onReply={() => undefined}
            onThread={null}
            onReview={() => undefined}
          />
          <Composer conversation={c} title={title} replyTo={null} replyName={null} onCancelReply={() => undefined} threadRoot={root} dropped={[]} onDroppedTaken={() => undefined} />
        </>
      ) : (
        <div className="empty">
          <p>This thread's first message isn't on this browser yet.</p>
        </div>
      )}
    </aside>
  );
}
