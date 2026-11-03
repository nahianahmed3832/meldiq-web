import { formatUiNumber } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { CommunityOwnerBadge } from "../components/CommunityOwnerBadge";
import { Bell, BellOff, Hash, Lock, MessageSquare, Search, Shield, ShieldCheck, User, UserPlus, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Conversation, Member } from "../../api/schemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate, useRoute } from "../../application/router";
import { conversationMembers, startDirect } from "../../sync/account";
import { levelOf, muteToggle, workspaceOf } from "../../sync/navPrefs";
import { presenceWords } from "../../sync/social";
import { GroupAvatar, UserAvatar } from "../components/OrgAvatar";
import { LookAvatar, LookName } from "../people/NameStyle";
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
      .catch((e: unknown) => setError(e instanceof Error ? e.message : uiText("messaging.interface.couldn_t_load_members_cda1fcf")));
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
  return (i: { outgoing: boolean; senderUserId: string }) => (i.outgoing ? uiText("workspace.nav_you") : (users[i.senderUserId]?.displayName ?? uiText("messaging.interface.unknown_b764cdc")));
}
export function DetailsPanel({ conversationId, onClose }: { conversationId: string; onClose: () => void }) {
  useLocaleRender();
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
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const route = useRoute();
  const users = useOrbit((s) => s.users);
  const nav = useOrbit((s) => s.nav[workspaceOf(c.orgId)]);
  const { members, error, reload } = useMembers(c.id, c.memberCount);
  const { gallery, links } = useShared(c.id);
  const nameOf = useSenderName();
  const pinned = usePinned(c.id).length;
  const paged = useOrbit((s) => s.server?.features.includes("message-collections") ?? false);
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
    })().catch((e: unknown) => engine.notice("error", e instanceof Error ? e.message : uiText("organization.interface.couldn_t_change_notifications_9c82a42")));
  const actions: DetailsAction[] = [
    { key: "search", label: l10n("common.actions.search"), icon: <Search size={20} />, onClick: () => navigate({ section: route.section, conversationId: c.id, panel: "search" }) },
    {
      key: "mute",
      label: muted ? uiText("notifications.bell_unmute") : uiText("notifications.bell_mute"),
      icon: muted ? <BellOff size={20} /> : <Bell size={20} />,
      onClick: toggleMute,
      active: muted,
    },
    ...(peer ? [{ key: "profile", label: l10n("settings.profile"), icon: <User size={20} />, onClick: () => openProfile(peer.id, peer.displayName) }] : []),
    ...(c.type === "GROUP" && c.canManage ? [{ key: "add", label: l10n("common.actions.add"), icon: <UserPlus size={20} />, onClick: () => setSheet("add") }] : []),
    { key: "security", label: l10n("settings.security"), icon: <Shield size={20} />, onClick: () => setSheet("security") },
  ];
  const avatar =
    c.type === "DM" && peer ? (
      <LookAvatar userId={peer.id} name={title} colorIndex={peer.avatarColor} photoRev={users[peer.id]?.photoRev} size={72} />
    ) : (
      <GroupAvatar conversationId={c.id} name={title} photoRev={c.photoRev} size={72} />
    );
  const sub = peerMember ? [`@${peerMember.username}`, peerMember.pronouns].filter(Boolean).join(" · ") : c.type === "GROUP" ? membersText(c.memberCount) : null;
  const presence = peerMember ? presenceWords(peerMember.presence, peerMember.online) : null;
  const counts = { members: c.memberCount, media: paged ? undefined : gallery.media.length, pins: paged ? undefined : pinned, links: links.length, files: paged ? undefined : gallery.files.length };
  const memberIds = new Set((members ?? []).map((m) => m.id));
  return (
    <aside className="panel" aria-label={uiText("organization.interface.details_45989de")}>
      <PanelHead title={uiText("organization.interface.details_45989de")} sub={title} onClose={onClose} />
      <div className="panel-body scroll">
        <DetailsHero avatar={avatar} title={c.type === "DM" && peer ? <LookName userId={peer.id} name={title} withMarks /> : title} sub={sub} presence={presence} />
        <DetailsActions actions={actions} />
        {peerMember && (
          <button className="panel-action-row" onClick={() => setSheet("newGroup")}>
            <span className="circle">
              <UsersRound size={16} />
            </span>
            <span className="lines grow">
              <span>
                <Localized k="messaging.interface.new_group_df796c6" />
              </span>
              <small>
                <Localized k="messaging.interface.start_a_group_with_0996872" slots={[peerMember.displayName]} />
              </small>
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
        <h3 className="details-settings-head">{l10n("settings.title")}</h3>
        <AboutCards c={c} />
        <ConversationSettings conversationId={c.id} />
      </div>
      {sheet === "security" && <SecuritySheet conversationId={c.id} onClose={() => setSheet(null)} />}
      {sheet === "add" && <AddMembersDialog c={c} memberIds={memberIds} onAdded={reload} onClose={() => setSheet(null)} />}
      {sheet === "newGroup" && peerMember && <NewGroupDialog initial={[peerMember]} onClose={() => setSheet(null)} />}
    </aside>
  );
}
/** The conversation's facts, and in a DM blocking; a group's photo. (The safety number card was retired, brief v4 §13.) */
export function AboutCards({ c }: { c: Conversation }) {
  useLocaleRender();
  const me = useOrbit((s) => s.me);
  const peer = me && c.type === "DM" ? dmPeer(c, me.userId) : null;
  return (
    <>
      <div className="panel-card">
        <dl style={{ margin: 0 }}>
          {c.type === "CHANNEL" && (
            <div>
              <dt>
                <Localized k="messaging.interface.topic_7e61847" />
              </dt>
              <dd>
                {c.topic ?? (
                  <span className="faint">
                    <Localized k="messaging.interface.no_topic_f547802" />
                  </span>
                )}
              </dd>
            </div>
          )}
          <div>
            <dt>
              <Localized k="messaging.interface.type_baaddf7" />
            </dt>
            <dd className="row" style={{ gap: 6 }}>
              {c.type === "CHANNEL" ? c.kind === "PRIVATE" ? <Lock size={14} /> : <Hash size={14} /> : <MessageSquare size={14} />}
              {c.type === "CHANNEL"
                ? uiText("messaging.interface.value0_channel_value1_9c32181", {
                    value0:
                      c.kind === "PRIVATE"
                        ? uiText("workspace.interface.private_c63eb67")
                        : c.kind === "ANNOUNCEMENT"
                          ? uiText("organization.interface.announcement_028cd1c")
                          : uiText("workspace.interface.public_591935b"),
                    value1: c.scopeName ? uiText("workspace.interface.in_value0_e1b84d9", { value0: c.scopeName }) : "",
                  })
                : c.type === "GROUP"
                  ? uiText("messaging.interface.group_34ca0e7")
                  : uiText("messaging.interface.direct_message_cd3e160")}
            </dd>
          </div>
          <div>
            <dt>
              <Localized k="messaging.interface.created_d70b9e2" />
            </dt>
            <dd>{dayLabel(c.createdAt)}</dd>
          </div>
          <div>
            <dt>
              <Localized k="messaging.interface.encryption_82f4e71" />
            </dt>
            <dd className="row" style={{ gap: 6 }}>
              <Localized k="messaging.interface.kept_on_meldiq_s_servers_on_all_your_devices_4d65162" slots={[<ShieldCheck size={14} />]} />
            </dd>
          </div>
        </dl>
        {c.type !== "DM" && c.canManage && (
          <div>
            <EditConversationButton c={c} />
          </div>
        )}
      </div>

      {peer && (
        <div className="panel-card">
          <div>
            <BlockToggle userId={peer.id} name={peer.displayName} />
          </div>
        </div>
      )}

      <GroupPhotoCard c={c} title={c.name ?? uiText("messaging.interface.group_34ca0e7")} />
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
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const me = useOrbit((s) => s.me?.userId);
  const memberIds = useMemo(() => new Set((members ?? []).map((m) => m.id)), [members]);
  return (
    <div style={{ display: "grid", gap: 12 }} role="tabpanel" aria-label={l10n("workspace.members")}>
      <div className="panel-section-title">
        <span>{l10n("workspace.members")}</span>
        <span>{formatUiNumber(c.memberCount)}</span>
      </div>
      {showAdd && <AddMembersButton c={c} memberIds={memberIds} onAdded={onAdded} />}
      {error && <div className="banner danger">{error}</div>}
      {!members && !error && <span className="skeleton" style={{ height: 120 }} />}
      {members?.map((m) => (
        <div key={m.id} className="person">
          <UserAvatar userId={m.id} name={m.displayName} colorIndex={m.avatarColor} photoRev={m.photoRev} size={32} online={m.online} presence={m.presence} decorative />
          <div className="lines grow">
            <button className="ellipsis person-name" onClick={() => openProfile(m.id, m.displayName)}>
              {m.displayName}
              {m.id === me ? uiText("messaging.interface.you_9d84cd4") : ""}
            </button>
            {c.orgId && m.orgRole === "OWNER" && <CommunityOwnerBadge />}
            <small className="ellipsis">
              @{m.username}
              {m.role === "ADMIN" ? uiText("messaging.interface.admin_fdc0e04") : ""}
              {m.orgRole && m.orgRole !== "MEMBER" ? uiText("calls.interface.value0_9402340", { value0: m.orgRole.toLowerCase() }) : ""}
            </small>
          </div>
          {m.id !== me && (
            <button
              className="icon-btn"
              aria-label={uiText("messaging.interface.message_value0_ddd26fd", { value0: m.displayName })}
              onClick={() => {
                void startDirect(engine, m.id)
                  .then((cid) => navigate({ section: "dms", conversationId: cid }))
                  .catch((e: unknown) => engine.notice("error", e instanceof Error ? e.message : uiText("workspace.interface.couldn_t_open_the_conversation_1f813b2")));
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
