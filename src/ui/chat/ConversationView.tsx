import { AppUpdatesBar } from "./AppUpdatesBar";
import { ChannelGlyph } from "../community/ChannelDialogs";
import { ForumView } from "./ForumView";
import { presenceWords } from "../../sync/social";
import { GroupAvatar } from "../components/OrgAvatar";
import { RequestBar, RequestSentBanner } from "../people/RequestBar";
import { VoiceRoomBanner } from "./VoiceRoomBanner";
import { SecurityPadlock } from "./SecuritySheet";
import { PinnedButton } from "./PinnedPanel";
import { Archive, ArrowLeft, BellOff, Info, MessagesSquare, Phone, Search, ShieldAlert, UsersRound, Video } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { shallowEqual, useEngine, useOrbit } from "../../app/orbit";
import { navigate, type Route } from "../../app/router";
import type { StoredMessage } from "../../model/types";
import { CallFailure } from "../../call/rules";
import { Avatar, colorIndexOf } from "../components/Avatar";
import { conversationTitle, dmPeer, members, relative } from "../format";
import type { ShellDialog } from "../shell/Shell";
import { Composer, useFileDrop } from "./Composer";
import { ConversationStart, MessageList } from "./MessageList";
import { useOnlineCount } from "./useOnlineCount";

export function ConversationView({ id, route, onDialog }: { id: string; route: Route; onDialog: (d: ShellDialog) => void }) {
  const engine = useEngine();
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
          online: u?.online ?? null,
          presence: u?.presence ?? null,
          pronouns: u?.pronouns ?? null,
          // Round 3: their status, and whether they paused notifications (when their last-seen setting lets you know).
          status: [u?.statusEmoji, u?.statusText].filter((x) => !!x).join(" ") || null,
          paused: u?.notificationsPaused === true,
        }
      : null;
  }, shallowEqual);
  const online = useOnlineCount(id, c?.type === "CHANNEL");
  const loaded = useOrbit((s) => s.messages[id]);
  const call = useOrbit((s) => s.calls[id]);
  const myCall = useOrbit((s) => (s.call.phase === "idle" || s.call.phase === "ended" ? null : s.call.conversationId));
  const calling = useOrbit((s) => s.server?.calling === true);
  const history = useOrbit((s) => s.history.status);
  const memberIds = useMemo(() => new Set((c?.members ?? []).map((m) => m.id)), [c?.members]);
  const alerts = useOrbit(
    (s) => s.identityAlerts.filter((a) => memberIds.has(a.userId) || c?.type !== "DM"),
    (a, b) => a.length === b.length && a.every((x, i) => x === b[i]),
  );
  const [replyTo, setReplyTo] = useState<StoredMessage | null>(null);
  const drop = useFileDrop(!!c?.canPost);
  const users = useOrbit((s) => s.users);

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
        : [c.topic, members(c.memberCount), online ? `${online} online` : null, c.categoryName ?? (c.scope === "ORG" ? null : c.scopeName)].filter(Boolean).join(" · ");
  const panelOpen = route.panel === "details";

  return (
    <section className="main conversation" aria-label={`Conversation: ${title}`} {...drop.handlers} style={{ position: "relative" }}>
      <header className="conv-head">
        <button className="icon-btn back" onClick={() => navigate({ section: route.section })} aria-label="Back to conversations">
          <ArrowLeft size={19} />
        </button>
        {c.type === "DM" ? (
          <Avatar name={title} colorIndex={peer?.color ?? 0} size={34} online={peer?.online} presence={peer?.presence} decorative />
        ) : c.type === "GROUP" ? (
          <GroupAvatar conversationId={c.id} name={title} photoRev={c.photoRev} size={34} />
        ) : null}
        <div className="conv-title">
          <h1>
            {glyph}
            <span className="ellipsis">{title}</span>
            {c.archived && (
              <span className="tag">
                <Archive size={11} /> Archived
              </span>
            )}
          </h1>
          <p className="ellipsis">{subtitle}</p>
        </div>
        {/* Calls in a workspace happen in its voice rooms; a text channel has none to start (android round 7). */}
        {c.type !== "CHANNEL" && !c.request && <CallButtons conversationId={id} canPost={c.canPost} archived={c.archived} serverCalling={calling} busy={myCall !== null} running={!!call} />}
        {c.type !== "DM" && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate({ section: route.section, conversationId: id, panel: panelOpen ? null : "details" })}
            aria-label={`${members(c.memberCount)}, show details`}
          >
            <UsersRound size={16} /> {c.memberCount}
          </button>
        )}
        <button
          className="icon-btn"
          aria-pressed={route.panel === "search"}
          onClick={() => navigate({ section: route.section, conversationId: id, panel: route.panel === "search" ? null : "search" })}
          aria-label={route.panel === "search" ? "Close search" : "Search in this conversation"}
          title="Search in this conversation"
        >
          <Search size={18} />
        </button>
        {c.type === "CHANNEL" && !c.voice && c.format !== "forum" && (
          <button
            className="icon-btn"
            aria-pressed={route.panel === "threads"}
            onClick={() => navigate({ section: route.section, conversationId: id, panel: route.panel === "threads" ? null : "threads" })}
            aria-label="Threads"
            title="Threads"
          >
            <MessagesSquare size={18} />
          </button>
        )}
        <PinnedButton conversationId={id} />
        <SecurityPadlock conversationId={id} />
        <button
          className="icon-btn"
          aria-pressed={panelOpen}
          onClick={() => navigate({ section: route.section, conversationId: id, panel: panelOpen ? null : "details" })}
          aria-label={panelOpen ? "Hide details" : "Show details"}
        >
          <Info size={19} />
        </button>
      </header>

      {c.type === "CHANNEL" && <AppUpdatesBar conversationId={id} />}
      {(alerts.length > 0 || call || c.voice || c.archived || history === "running" || peer?.paused || (c.request && !c.request.incoming)) && (
        <div className="conv-banners">
          {c.request && !c.request.incoming && <RequestSentBanner conversation={c} />}
          {peer?.paused && (
            <div className="banner" role="status">
              <BellOff size={16} aria-hidden />
              <span className="grow">{peer.name} has paused notifications</span>
            </div>
          )}
          {alerts.map((a) => (
            <div key={a.userId} className="banner warn" role="alert">
              <ShieldAlert size={16} />
              <span className="grow">{users[a.userId]?.displayName ?? "Someone"}'s security key changed. Messages to and from them are paused until you review it.</span>
              <button className="btn btn-secondary btn-sm" onClick={() => onDialog({ kind: "identity", userId: a.userId })}>
                Review
              </button>
            </div>
          ))}
          {c.voice && myCall !== id && <VoiceRoomBanner conversationId={id} canJoin={calling && engine.calls.supported() && myCall === null && !c.archived && c.canConnect !== false} />}
          {call && !c.voice && myCall !== id && (
            <div className="banner info call-banner">
              {call.video ? <Video size={16} /> : <Phone size={16} />}
              <span className="grow">
                A {call.video ? "video" : "voice"} call is in progress{call.createdAt ? `, started ${relative(call.createdAt)}` : ""}.
              </span>
              {calling && engine.calls.supported() && myCall === null && (
                <button className="btn btn-secondary btn-sm" onClick={() => void engine.calls.join(id, call.id, call.video)}>
                  Join
                </button>
              )}
            </div>
          )}
          {history === "running" && (
            <div className="banner info">
              <span className="grow">Restoring earlier messages from your encrypted history…</span>
            </div>
          )}
        </div>
      )}

      {c.type === "CHANNEL" && c.format === "forum" ? (
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

      {c.type === "CHANNEL" && c.format === "forum" ? null : c.request?.incoming ? (
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
      {drop.over && <div className="drop-overlay">Drop files to send them, encrypted, to {title}</div>}
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
