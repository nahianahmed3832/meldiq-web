import { ConversationMenu } from "./ConversationMenu";
import { UNKNOWN } from "../../api/enums";
import { ChannelGlyph } from "../community/ChannelDialogs";
import { ForumView } from "./ForumView";
import { presenceWords } from "../../sync/social";
import { GroupAvatar, UserAvatar } from "../components/OrgAvatar";
import { RequestBar, RequestSentBanner } from "../people/RequestBar";
import { ConnectionRequestBanner } from "../people/ConnectionRequestViews";
import { useConnectionLists } from "../people/connectionRequests";
import { VoiceRoomView } from "./VoiceRoomView";
import { Archive, ArrowLeft, BellOff, MonitorUp, Phone, Pin, Search, ShieldAlert, Video } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { shallowEqual, useEngine, useOrbit } from "../../application/orbit";
import { navigate, type Route } from "../../application/router";
import type { StoredMessage } from "../../model/types";
import { CallFailure } from "../../call/rules";
import { colorIndexOf } from "../components/Avatar";
import { conversationTitle, dmPeer, members, relative } from "../format";
import type { ShellDialog } from "../shell/Shell";
import { Composer, useFileDrop } from "./Composer";
import { ConversationStart, MessageList } from "./MessageList";
import { PeopleToggle } from "./PeoplePanels";
import { ChannelBell } from "./ChannelBell";
import { useT } from "../../i18n";

export function ConversationView({ id, route, onDialog }: { id: string; route: Route; onDialog: (d: ShellDialog) => void }) {
  const engine = useEngine();
  const t = useT();
  const c = useOrbit((s) => s.conversations[id]);
  const me = useOrbit((s) => s.me);
  const title = useOrbit((s) => (s.me && c ? conversationTitle(c, s.me.userId, s.users) : ""));
  const peer = useOrbit((s) => {
    if (!c || c.type !== "DM" || !s.me) return null;
    const p = dmPeer(c, s.me.userId);
    const u = p ? s.users[p.id] : undefined;
    return p
      ? {
          id: p.id,
          username: p.username,
          name: u?.displayName ?? p.displayName,
          color: p.avatarColor,
          photoRev: u?.photoRev ?? null,
          online: u?.online ?? null,
          presence: u?.presence ?? null,
          pronouns: u?.pronouns ?? null,
          // Round 3: their status, and whether they paused notifications (when their last-seen setting lets you know).
          status: [u?.statusEmoji, u?.statusText].filter((x) => !!x).join(" ") || null,
          paused: u?.notificationsPaused === true,
        }
      : null;
  }, shallowEqual);
  const loaded = useOrbit((s) => s.messages[id]);
  const call = useOrbit((s) => s.calls[id]);
  const myCall = useOrbit((s) => (s.call.phase === "idle" || s.call.phase === "ended" ? null : s.call.conversationId));
  const calling = useOrbit((s) => s.server?.calling === true);
  const sharers = useOrbit((s) => (s.calls[id]?.sharing ?? []).map((u) => s.users[u]?.displayName ?? t("react_someone")), shallowEqual);
  const history = useOrbit((s) => s.history.status);
  const memberIds = useMemo(() => new Set((c?.members ?? []).map((m) => m.id)), [c?.members]);
  const alerts = useOrbit(
    (s) => s.identityAlerts.filter((a) => memberIds.has(a.userId) || c?.type !== "DM"),
    (a, b) => a.length === b.length && a.every((x, i) => x === b[i]),
  );
  const [replyTo, setReplyTo] = useState<StoredMessage | null>(null);
  const drop = useFileDrop(!!c?.canPost);
  const users = useOrbit((s) => s.users);
  const askedToConnect = !!useConnectionLists()?.incoming.some((e) => e.user.id === peer?.id);

  const onThread = useCallback((m: StoredMessage) => navigate({ section: route.section, conversationId: id, panel: "thread", threadRoot: m.id }), [id, route.section]);
  const onReview = useCallback(() => {
    const first = engine.state.get().identityAlerts[0];
    if (first) onDialog({ kind: "identity", userId: first.userId });
  }, [engine, onDialog]);

  if (!c || !me) return null;
  const glyph = c.type !== "CHANNEL" ? null : <ChannelGlyph kind={c.kind} voice={c.voice} format={c.format} size={18} />;
  const subtitle =
    c.type === "DM"
      ? [`@${peer?.username ?? ""}`, peer?.pronouns, presenceWords(peer?.presence, peer?.online)?.toLowerCase(), peer?.status].filter(Boolean).join(" · ")
      : c.type === "GROUP"
        ? members(c.memberCount)
        : null; // a channel's line is built in the header below (who's online, with its dot)
  const panelOpen = route.panel === "details";

  return (
    <section className="main conversation" aria-label={`Conversation: ${title}`} {...drop.handlers} style={{ position: "relative" }}>
      <header className="conv-head">
        <button className="icon-btn back" onClick={() => navigate({ section: route.section })} aria-label={t("conv_back")}>
          <ArrowLeft size={19} />
        </button>
        {(() => {
          const titleBlock = (
            <>
              {c.type === "DM" ? (
                <UserAvatar userId={peer?.id ?? ""} name={title} colorIndex={peer?.color ?? 0} photoRev={peer?.photoRev} size={34} online={peer?.online} presence={peer?.presence} decorative />
              ) : c.type === "GROUP" ? (
                <GroupAvatar conversationId={c.id} name={title} photoRev={c.photoRev} size={34} />
              ) : null}
              <div className="conv-title">
                <h1>
                  {glyph}
                  <span className="ellipsis">{title}</span>
                  {c.type === "CHANNEL" && c.topic && <span className="conv-topic ellipsis hide-sm">{c.topic}</span>}
                  {c.archived && (
                    <span className="tag">
                      <Archive size={11} /> Archived
                    </span>
                  )}
                </h1>
                {/* A channel's header is one line, its name and topic (the reference); people's and groups' have a second. */}
                {c.type !== "CHANNEL" && <p className="ellipsis">{subtitle}</p>}
              </div>
            </>
          );
          // B14 and B14b: the name opens the details (members, media, pins, threads, links, files), as on Android.
          return (
            <button
              className="conv-title-btn"
              onClick={() => navigate({ section: route.section, conversationId: id, panel: panelOpen ? null : "details" })}
              aria-label={`${c.type === "CHANNEL" ? `#${title}` : title}: details`}
              aria-expanded={panelOpen}
            >
              {titleBlock}
            </button>
          );
        })()}
        {/* Calls in a community happen in its voice rooms; a text channel has none to start (android round 7). */}
        {c.type !== "CHANNEL" && !c.request && <CallButtons conversationId={id} canPost={c.canPost} archived={c.archived} serverCalling={calling} busy={myCall !== null} running={!!call} />}
        {/* Android A7: a text channel's bell (mute for a while, the channel's level). */}
        {c.type === "CHANNEL" && !c.voice && <ChannelBell c={c} />}
        {/* The reference header: bell, pins, members, then a search box. Phones keep the name, calls and the menu (as the
            Android app); pins and members are in the details the name opens, and search is on the list's header. */}
        {!c.voice && (
          <button
            className="icon-btn hide-sm"
            aria-pressed={route.panel === "pinned"}
            onClick={() => navigate({ section: route.section, conversationId: id, panel: route.panel === "pinned" ? null : "pinned" })}
            aria-label={t("conv_pins")}
            title={t("conv_pins")}
          >
            <Pin size={18} />
          </button>
        )}
        <PeopleToggle c={c} route={route} />
        {c.type !== "CHANNEL" && <ConversationMenu conversationId={id} route={route} />}
        <HeaderSearch orgId={c.orgId ?? null} onSearch={() => onDialog({ kind: "search" })} />
      </header>

      {(askedToConnect || alerts.length > 0 || (call && !c.voice) || c.archived || history === "running" || peer?.paused || (c.request && !c.request.incoming)) && (
        <div className="conv-banners">
          {c.request && !c.request.incoming && <RequestSentBanner conversation={c} />}
          {askedToConnect && peer && <ConnectionRequestBanner userId={peer.id} name={peer.name} />}
          {peer?.paused && (
            <div className="banner" role="status">
              <BellOff size={16} aria-hidden />
              <span className="grow">{t("conv_paused", { name: peer.name })}</span>
            </div>
          )}
          {alerts.map((a) => (
            <div key={a.userId} className="banner warn" role="alert">
              <ShieldAlert size={16} />
              <span className="grow">{t("conv_key_changed", { name: users[a.userId]?.displayName ?? t("conv_someone") })}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => onDialog({ kind: "identity", userId: a.userId })}>
                {t("conv_review")}
              </button>
            </div>
          ))}
          {call && !c.voice && myCall !== id && (
            <div className="banner info call-banner">
              {call.video ? <Video size={16} /> : <Phone size={16} />}
              <span className="grow">
                {call.createdAt ? t(call.video ? "conv_video_call_since" : "conv_voice_call_since", { when: relative(call.createdAt) }) : t(call.video ? "conv_video_call" : "conv_voice_call")}
              </span>
              {sharers.length > 0 && (
                <span className="voice-sharing">
                  <MonitorUp size={12} aria-hidden="true" /> {t("live_sharing", { names: sharers.join(", ") })}
                </span>
              )}
              {calling && engine.calls.supported() && myCall === null ? (
                <button className="btn btn-secondary btn-sm" onClick={() => void engine.calls.join(id, call.id, call.video)}>
                  {t("conv_join")}
                </button>
              ) : (
                // Why there's no Join (community-first brief §E): never a silent missing button.
                <small className="faint">{!calling ? t("call_why_server") : !engine.calls.supported() ? t("call_why_browser") : t("call_why_busy")}</small>
              )}
            </div>
          )}
          {history === "running" && (
            <div className="banner info">
              <span className="grow">{t("conv_restoring")}</span>
            </div>
          )}
        </div>
      )}

      {c.voice ? (
        <VoiceRoomView c={c} />
      ) : c.type === "CHANNEL" && c.format === "forum" ? (
        <ForumView c={c} section={route.section} />
      ) : loaded ? (
        <MessageList
          conversationId={id}
          items={loaded.items}
          hasMore={loaded.hasMore}
          onLoadOlder={() => engine.loadOlder(id)}
          canPost={c.canPost}
          onReply={setReplyTo}
          onThread={onThread}
          onReview={onReview}
          start={
            <ConversationStart
              type={c.type}
              kind={c.kind}
              title={title}
              topic={c.topic}
              color={peer?.color ?? colorIndexOf(c.id)}
              avatar={
                c.type === "DM" && peer ? (
                  <UserAvatar userId={peer.id} name={title} colorIndex={peer.color} photoRev={peer.photoRev} size={52} decorative />
                ) : c.type === "GROUP" ? (
                  <GroupAvatar conversationId={c.id} name={title} photoRev={c.photoRev} size={52} />
                ) : undefined
              }
              onManage={c.type === "CHANNEL" && c.canManage ? () => navigate({ section: route.section, conversationId: id, panel: "details" }) : undefined}
            />
          }
        />
      ) : (
        <div className="messages" aria-busy="true" style={{ padding: 18, display: "grid", gap: 18, alignContent: "end" }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="row" style={{ alignItems: "flex-start", gap: 12 }}>
              <span className="skeleton" style={{ width: 38, height: 38, borderRadius: "50%" }} />
              <div style={{ display: "grid", gap: 6, flex: 1 }}>
                <span className="skeleton" style={{ width: 140, height: 12 }} />
                <span className="skeleton" style={{ width: `${40 + i * 15}%`, height: 12 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* A voice channel is for talking: no messages (batch B14; the server refuses them too). Its room page has Join. */}
      {(c.type === "CHANNEL" && c.format === "forum") || c.voice ? null : c.format === UNKNOWN ? (
        <div className="banner info" role="status" style={{ margin: 12 }}>
          This channel is of a kind this version of Meldiq Web can't post in yet. Its messages are shown above.
        </div>
      ) : c.request?.incoming ? (
        <RequestBar conversation={c} name={title} />
      ) : (
        <Composer
          conversation={c}
          title={title}
          replyTo={replyTo}
          replyName={replyTo ? (replyTo.outgoing ? "yourself" : (users[replyTo.senderUserId]?.displayName ?? "Unknown")) : null}
          onCancelReply={() => setReplyTo(null)}
          dropped={drop.dropped}
          onDroppedTaken={drop.take}
        />
      )}
      {drop.over && <div className="drop-overlay">Drop files to send them to {title}</div>}
    </section>
  );
}

interface CallButtonsProps {
  conversationId: string;
  canPost: boolean;
  archived: boolean;
  serverCalling: boolean;
  /** This browser is already in a call. */
  busy: boolean;
  /** A call is running in this conversation (join it from the banner). */
  running: boolean;
}

/** Voice and video call buttons; disabled with the reason when calling can't work here. */
function CallButtons({ conversationId, canPost, archived, serverCalling, busy, running }: CallButtonsProps) {
  const engine = useEngine();
  const why = !serverCalling
    ? "Calling isn't set up on this server"
    : !engine.calls.supported()
      ? CallFailure.UNSUPPORTED
      : archived
        ? "This channel is archived"
        : !canPost
          ? "You can't start calls here"
          : busy
            ? "You're already in a call"
            : running
              ? "A call is in progress: join it below"
              : null;
  return (
    <span className="conv-call-actions">
      <button className="icon-btn" onClick={() => void engine.calls.startCall(conversationId, false)} disabled={why !== null} aria-label="Start a voice call" title={why ?? "Voice call"}>
        <Phone size={18} />
      </button>
      <button className="icon-btn" onClick={() => void engine.calls.startCall(conversationId, true)} disabled={why !== null} aria-label="Start a video call" title={why ?? "Video call"}>
        <Video size={19} />
      </button>
    </span>
  );
}

/**
 * The header's search box (the reference's "Search MINECRAFT"): Meldiq's search for this community (conversations,
 * people, and messages found on this device: the server can't read them). The same as ⌘K.
 */
function HeaderSearch({ orgId, onSearch }: { orgId: string | null; onSearch: () => void }) {
  const t = useT();
  const orgName = useOrbit((s) => (orgId ? (s.orgs.find((o) => o.id === orgId)?.name ?? null) : null));
  const label = orgName ? t("conv_search_in", { name: orgName }) : t("search_short");
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <button className="header-search hide-sm" onClick={onSearch} aria-label={label} aria-keyshortcuts={mac ? "Meta+K" : "Control+K"}>
      <span className="ellipsis">{label}</span>
      <Search size={15} aria-hidden="true" />
    </button>
  );
}
