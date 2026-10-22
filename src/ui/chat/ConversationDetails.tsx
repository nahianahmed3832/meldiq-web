import { Bell, BellOff, Fingerprint, Hash, Lock, MessageSquare, Search, Shield, ShieldCheck, User, UserPlus, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Conversation, Member } from "../../api/schemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate, useRoute } from "../../application/router";
import { safetyNumber } from "../../crypto/identity";
import { conversationMembers, startDirect, userProfile } from "../../sync/account";
import { levelOf, muteToggle, workspaceOf } from "../../sync/navPrefs";
import { presenceWords } from "../../sync/social";
import { Avatar } from "../components/Avatar";
import { GroupAvatar, UserAvatar } from "../components/OrgAvatar";
import { NewGroupDialog } from "../dialogs/NewGroupDialog";
import { conversationTitle, dayLabel, dmPeer, members as membersText } from "../format";
import { GroupPhotoCard } from "../people/GroupPhotoCard";
import { openProfile } from "../people/ProfileDialog";
import { AddMembersButton, AddMembersDialog, BlockToggle, EditConversationButton } from "./ConversationManage";
import { ConversationSettings } from "./ConversationSettings";
import { type DetailsAction, DetailsActions, DetailsHero, DetailsTabBar, FilesTab, LinksTab, MediaTab, PinsTab } from "./DetailsTabs";
import { type DetailsTab, detailsTabs } from "./detailsRules";
import { galleryOf, linksOf } from "./gallery";
import { PanelHead } from "./PanelHead";
import { usePinned } from "./PinnedPanel";
import { SecuritySheet } from "./SecuritySheet";
import { ChannelDetails } from "./ChannelDetails";

/** A conversation's members, loaded again when someone joins or leaves (here or on another device). */
export function useMembers(conversationId: string, memberCount: number | undefined) {
  const engine = useEngine();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    conversationMembers(engine, conversationId)
      .then((list) => {
        setMembers(list);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't load members"));
  }, [engine, conversationId]);
  useEffect(() => {
    setMembers(null);
    reload();
  }, [reload, memberCount]);
  return { members, error, reload };
}

/** Photos, videos, files and links in the messages this browser has loaded. */
export function useShared(conversationId: string) {
  const loaded = useOrbit((s) => s.messages[conversationId]?.items);
  const gallery = useMemo(() => galleryOf(loaded ?? []), [loaded]);
  const links = useMemo(() => linksOf(loaded ?? []), [loaded]);
  return { gallery, links };
}

export function useSenderName() {
  const users = useOrbit((s) => s.users);
  return (i: { outgoing: boolean; senderUserId: string }) => (i.outgoing ? "You" : (users[i.senderUserId]?.displayName ?? "Unknown"));
}

export function DetailsPanel({ conversationId, onClose }: { conversationId: string; onClose: () => void }) {
  const c = useOrbit((s) => s.conversations[conversationId]);
  const me = useOrbit((s) => s.me);
  if (!c || !me) return null;
  // Batches B14 and B14b: a direct message or group, and a channel, each have a details page like Android's.
  // Keyed by conversation: another conversation's details start on their own first tab, with nothing carried over.
  return c.type === "CHANNEL" ? <ChannelDetails key={c.id} c={c} onClose={onClose} /> : <ChatDetails key={c.id} c={c} me={me.userId} onClose={onClose} />;
}

/**
 * A direct message's or group's details (batch B14, android DmDetails): the photo and name, round actions, New group
 * with this person (DMs), tabs backed by what the conversation holds, then its settings.
 */
function ChatDetails({ c, me, onClose }: { c: Conversation; me: string; onClose: () => void }) {
  const engine = useEngine();
  const route = useRoute();
  const users = useOrbit((s) => s.users);
  const nav = useOrbit((s) => s.nav[workspaceOf(c.orgId)]);
  const { members, error, reload } = useMembers(c.id, c.memberCount);
  const { gallery, links } = useShared(c.id);
  const nameOf = useSenderName();
  const pinned = usePinned(c.id).length;
  const tabs = detailsTabs(c.type);
  const [tab, setTab] = useState<DetailsTab>(tabs[0]);
  const [sheet, setSheet] = useState<"security" | "add" | "newGroup" | null>(null);

  const title = conversationTitle(c, me, users);
  const peer = c.type === "DM" ? dmPeer(c, me) : null;
  const peerMember = peer ? members?.find((m) => m.id === peer.id) : undefined;
  const muted = levelOf(nav, c.id, c.categoryId) === "none";
  const toggleMute = () =>
    void (async () => {
      for (const op of muteToggle(nav, c.id, c.categoryId)) await engine.arrange(c.id, op);
    })().catch((e: unknown) => engine.notice("error", e instanceof Error ? e.message : "Couldn't change notifications"));

  const actions: DetailsAction[] = [
    { key: "search", label: "Search", icon: <Search size={20} />, onClick: () => navigate({ section: route.section, conversationId: c.id, panel: "search" }) },
    { key: "mute", label: muted ? "Unmute" : "Mute", icon: muted ? <BellOff size={20} /> : <Bell size={20} />, onClick: toggleMute, active: muted },
    ...(peer ? [{ key: "profile", label: "Profile", icon: <User size={20} />, onClick: () => openProfile(peer.id, peer.displayName) }] : []),
    ...(c.type === "GROUP" && c.canManage ? [{ key: "add", label: "Add", icon: <UserPlus size={20} />, onClick: () => setSheet("add") }] : []),
    { key: "security", label: "Security", icon: <Shield size={20} />, onClick: () => setSheet("security") },
  ];
  const avatar =
    c.type === "DM" && peer ? (
      <UserAvatar userId={peer.id} name={title} colorIndex={peer.avatarColor} photoRev={users[peer.id]?.photoRev} size={72} decorative />
    ) : (
      <GroupAvatar conversationId={c.id} name={title} photoRev={c.photoRev} size={72} />
    );
  const sub = peerMember ? [`@${peerMember.username}`, peerMember.pronouns].filter(Boolean).join(" · ") : c.type === "GROUP" ? membersText(c.memberCount) : null;
  const presence = peerMember ? presenceWords(peerMember.presence, peerMember.online) : null;
  const counts = { members: c.memberCount, media: gallery.media.length, pins: pinned, links: links.length, files: gallery.files.length };
  const memberIds = new Set((members ?? []).map((m) => m.id));

  return (
    <aside className="panel" aria-label="Details">
      <PanelHead title="Details" sub={title} onClose={onClose} />
      <div className="panel-body scroll">
        <DetailsHero avatar={avatar} title={title} sub={sub} presence={presence} />
        <DetailsActions actions={actions} />
        {peerMember && (
          <button className="panel-action-row" onClick={() => setSheet("newGroup")}>
            <span className="circle">
              <UsersRound size={16} />
            </span>
            <span className="lines grow">
              <span>New group</span>
              <small>Start a group with {peerMember.displayName}</small>
            </span>
          </button>
        )}
        <DetailsTabBar tabs={tabs} tab={tab} onTab={setTab} counts={counts} />
        <div className="details-tab-body" key={tab}>
          {tab === "members" && <MembersList c={c} members={members} error={error} onAdded={reload} showAdd={false} />}
          {tab === "media" && <MediaTab conversationId={c.id} gallery={gallery} nameOf={nameOf} />}
          {tab === "files" && <FilesTab conversationId={c.id} gallery={gallery} nameOf={nameOf} />}
          {tab === "pins" && <PinsTab conversationId={c.id} />}
          {tab === "links" && <LinksTab conversationId={c.id} links={links} nameOf={nameOf} />}
        </div>
        <h3 className="details-settings-head">Settings</h3>
        <AboutCards c={c} />
        <ConversationSettings conversationId={c.id} />
      </div>
      {sheet === "security" && <SecuritySheet conversationId={c.id} onClose={() => setSheet(null)} />}
      {sheet === "add" && <AddMembersDialog c={c} memberIds={memberIds} onAdded={reload} onClose={() => setSheet(null)} />}
      {sheet === "newGroup" && peerMember && <NewGroupDialog initial={[peerMember]} onClose={() => setSheet(null)} />}
    </aside>
  );
}

/** The conversation's facts, and in a DM the safety number and blocking; a group's photo. */
export function AboutCards({ c }: { c: Conversation }) {
  const engine = useEngine();
  const me = useOrbit((s) => s.me);
  const peer = me && c.type === "DM" ? dmPeer(c, me.userId) : null;
  const [safety, setSafety] = useState<string | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);

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

  return (
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
            <button className="btn btn-secondary btn-sm" onClick={() => void engine.markVerified(peer.id, !verified).then(() => setVerified(!verified))}>
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
  );
}

interface MembersListProps {
  c: Conversation;
  members: Member[] | null;
  error: string | null;
  onAdded: () => void;
  /** A channel adds people from its list; a group from the details' Add action. */
  showAdd: boolean;
}

export function MembersList({ c, members, error, onAdded, showAdd }: MembersListProps) {
  const engine = useEngine();
  const me = useOrbit((s) => s.me?.userId);
  const memberIds = useMemo(() => new Set((members ?? []).map((m) => m.id)), [members]);
  return (
    <div style={{ display: "grid", gap: 4 }} role="tabpanel" aria-label="Members">
      <div className="panel-section-title">
        <span>Members</span>
        <span>{c.memberCount}</span>
      </div>
      {showAdd && <AddMembersButton c={c} memberIds={memberIds} onAdded={onAdded} />}
      {error && <div className="banner danger">{error}</div>}
      {!members && !error && <span className="skeleton" style={{ height: 120 }} />}
      {members?.map((m) => (
        <div key={m.id} className="person">
          <Avatar name={m.displayName} colorIndex={m.avatarColor} size={32} online={m.online} presence={m.presence} decorative />
          <div className="lines grow">
            <button className="ellipsis person-name" onClick={() => openProfile(m.id, m.displayName)}>
              {m.displayName}
              {m.id === me ? " (you)" : ""}
            </button>
            <small className="ellipsis">
              @{m.username}
              {m.role === "ADMIN" ? " · admin" : ""}
              {m.orgRole && m.orgRole !== "MEMBER" ? ` · ${m.orgRole.toLowerCase()}` : ""}
            </small>
          </div>
          {m.id !== me && (
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
  );
}
