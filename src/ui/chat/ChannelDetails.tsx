import { ArrowLeft, Bell, BellOff, ChevronRight, KeyRound, Search, Settings, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { Conversation } from "../../api/schemas";
import { useEngine, useOrbit } from "../../app/orbit";
import { navigate, useRoute } from "../../app/router";
import { levelOf, muteToggle, workspaceOf } from "../../sync/navPrefs";
import { ChannelGlyph } from "../community/ChannelDialogs";
import { PermissionsDialog } from "../community/PermissionsDialog";
import { members as membersText } from "../format";
import { AboutCards, MembersList, useMembers, useSenderName, useShared } from "./ConversationDetails";
import { ConversationSettings } from "./ConversationSettings";
import { type DetailsAction, DetailsActions, DetailsHero, DetailsTabBar, FilesTab, LinksTab, MediaTab, PinsTab } from "./DetailsTabs";
import { type DetailsTab, detailsTabs } from "./detailsRules";
import { PanelHead } from "./PanelHead";
import { usePinned } from "./PinnedPanel";
import { SecuritySheet } from "./SecuritySheet";
import { ThreadList } from "./ThreadsPanel";

/** What kind of channel this is, in words. */
function kindOf(c: Conversation): string {
  const kind = c.voice ? "Voice channel" : c.format === "forum" ? "Forum" : c.kind === "ANNOUNCEMENT" ? "Announcement channel" : c.kind === "PRIVATE" ? "Private channel" : "Channel";
  return c.categoryName ? `${kind} in ${c.categoryName}` : kind;
}

/**
 * A channel's details (batch B14b, android DmDetails for channels): search, notifications and settings; the channel's
 * icon, name, kind and topic; tabs Members · Media · Pins · Threads · Links · Files (no Threads for a forum, whose posts are
 * its threads; members only for a voice channel). Members starts with "Manage channel access" for its managers. Security is
 * a row at the end; settings (about, access, notifications, edit) are behind the gear. There's no Leave: people leave
 * the community, not one of its channels (the server refuses it, API 0.26.0).
 */
export function ChannelDetails({ c, onClose }: { c: Conversation; onClose: () => void }) {
  const engine = useEngine();
  const route = useRoute();
  const nav = useOrbit((s) => s.nav[workspaceOf(c.orgId)]);
  const { members, error, reload } = useMembers(c.id, c.memberCount);
  const { gallery, links } = useShared(c.id);
  const nameOf = useSenderName();
  const pinned = usePinned(c.id).length;
  const tabs = detailsTabs("CHANNEL", c.format, c.voice);
  const [tab, setTab] = useState<DetailsTab>(tabs[0]);
  const [view, setView] = useState<"details" | "settings">("details");
  const [sheet, setSheet] = useState<"security" | "access" | null>(null);
  const name = `#${c.name ?? "channel"}`;
  const muted = levelOf(nav, c.id, c.categoryId) === "none";
  const toggleMute = () =>
    void (async () => {
      for (const op of muteToggle(nav, c.id, c.categoryId)) await engine.arrange(c.id, op);
    })().catch((e: unknown) => engine.notice("error", e instanceof Error ? e.message : "Couldn't change notifications"));
  const canManageAccess = c.canManage && !!c.orgId;

  const accessRow = canManageAccess && (
    <button className="panel-action-row" onClick={() => setSheet("access")}>
      <span className="circle">
        <KeyRound size={16} />
      </span>
      <span className="lines grow">
        <span>Manage channel access</span>
        <small>Who can see and post here, by role or person</small>
      </span>
      <ChevronRight size={16} className="faint" aria-hidden />
    </button>
  );
  const sheets = (
    <>
      {sheet === "security" && <SecuritySheet conversationId={c.id} onClose={() => setSheet(null)} />}
      {sheet === "access" && c.orgId && <PermissionsDialog orgId={c.orgId} target={{ type: "channel", id: c.id }} title={name} onClose={() => setSheet(null)} />}
    </>
  );

  if (view === "settings")
    return (
      <aside className="panel" aria-label="Channel settings">
        <PanelHead
          title="Channel settings"
          sub={name}
          onClose={onClose}
          actions={
            <button className="icon-btn" onClick={() => setView("details")} aria-label="Back to the channel's details">
              <ArrowLeft size={18} />
            </button>
          }
        />
        <div className="panel-body scroll">
          <AboutCards c={c} />
          {accessRow}
          <ConversationSettings conversationId={c.id} />
        </div>
        {sheets}
      </aside>
    );

  const actions: DetailsAction[] = [
    ...(c.voice ? [] : [{ key: "search", label: "Search", icon: <Search size={20} />, onClick: () => navigate({ section: route.section, conversationId: c.id, panel: "search" }) }]),
    { key: "mute", label: muted ? "Unmute" : "Mute", icon: muted ? <BellOff size={20} /> : <Bell size={20} />, onClick: toggleMute, active: muted },
    { key: "settings", label: "Settings", icon: <Settings size={20} />, onClick: () => setView("settings") },
  ];
  const counts = { members: c.memberCount, media: gallery.media.length, pins: pinned, links: links.length, files: gallery.files.length };
  return (
    <aside className="panel" aria-label="Details">
      <PanelHead title="Details" sub={name} onClose={onClose} />
      <div className="panel-body scroll">
        <DetailsHero
          avatar={
            <span className="details-channel-icon" aria-hidden>
              <ChannelGlyph kind={c.kind} voice={c.voice} format={c.format} size={30} />
            </span>
          }
          title={name}
          sub={`${kindOf(c)} · ${membersText(c.memberCount)}`}
          presence={null}
        />
        {c.topic && <p className="details-topic">{c.topic}</p>}
        <DetailsActions actions={actions} />
        <DetailsTabBar tabs={tabs} tab={tab} onTab={setTab} counts={counts} />
        <div className="details-tab-body" key={tab}>
          {tab === "members" && (
            <>
              {accessRow}
              <MembersList c={c} members={members} error={error} onAdded={reload} showAdd />
            </>
          )}
          {tab === "media" && <MediaTab conversationId={c.id} gallery={gallery} nameOf={nameOf} />}
          {tab === "files" && <FilesTab conversationId={c.id} gallery={gallery} nameOf={nameOf} />}
          {tab === "pins" && <PinsTab conversationId={c.id} />}
          {tab === "threads" && <ThreadList conversationId={c.id} section={route.section} />}
          {tab === "links" && <LinksTab conversationId={c.id} links={links} nameOf={nameOf} />}
        </div>
        <button className="panel-action-row" onClick={() => setSheet("security")}>
          <span className="circle">
            <ShieldCheck size={16} />
          </span>
          <span className="lines grow">
            <span>Encryption and security</span>
            <small>Messages here are end-to-end encrypted on your devices</small>
          </span>
          <ChevronRight size={16} className="faint" aria-hidden />
        </button>
      </div>
      {sheets}
    </aside>
  );
}
