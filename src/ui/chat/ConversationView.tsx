import { Archive, ArrowLeft, Hash, Info, Lock, Megaphone, Phone, ShieldAlert, UsersRound, Video } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { shallowEqual, useEngine, useOrbit } from "../../app/orbit";
import { navigate, type Route } from "../../app/router";
import type { StoredMessage } from "../../model/types";
import { Avatar, colorIndexOf } from "../components/Avatar";
import { conversationTitle, dmPeer, relative } from "../format";
import type { ShellDialog } from "../shell/Shell";
import { Composer, useFileDrop } from "./Composer";
import { ConversationStart, MessageList } from "./MessageList";

export function ConversationView({ id, route, onDialog }: { id: string; route: Route; onDialog: (d: ShellDialog) => void }) {
  const engine = useEngine();
  const c = useOrbit((s) => s.conversations[id]);
  const me = useOrbit((s) => s.me);
  const title = useOrbit((s) => (s.me && c ? conversationTitle(c, s.me.userId, s.users) : ""));
  const peer = useOrbit((s) => {
    if (!c || c.type !== "DM" || !s.me) return null;
    const p = dmPeer(c, s.me.userId);
    return p ? { id: p.id, username: p.username, color: p.avatarColor, online: s.users[p.id]?.online ?? null } : null;
  }, shallowEqual);
  const loaded = useOrbit((s) => s.messages[id]);
  const call = useOrbit((s) => s.calls[id]);
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
  const glyph = c.type === "CHANNEL" ? c.kind === "PRIVATE" ? <Lock size={18} /> : c.kind === "ANNOUNCEMENT" ? <Megaphone size={18} /> : <Hash size={19} /> : null;
  const subtitle =
    c.type === "DM"
      ? `@${peer?.username ?? ""}${peer?.online === true ? " · online" : ""}`
      : c.type === "GROUP"
        ? `${c.memberCount} members`
        : [c.topic, `${c.memberCount} members`, c.scope === "ORG" ? null : c.scopeName].filter(Boolean).join(" · ");
  const panelOpen = route.panel === "details";

  return (
    <section className="main conversation" aria-label={`Conversation: ${title}`} {...drop.handlers} style={{ position: "relative" }}>
      <header className="conv-head">
        <button className="icon-btn back" onClick={() => navigate({ section: route.section })} aria-label="Back to conversations">
          <ArrowLeft size={19} />
        </button>
        {c.type === "DM" ? (
          <Avatar name={title} colorIndex={peer?.color ?? 0} size={34} online={peer?.online} decorative />
        ) : c.type === "GROUP" ? (
          <Avatar name={title} colorIndex={colorIndexOf(c.id)} size={34} decorative />
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
        {c.type !== "DM" && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate({ section: route.section, conversationId: id, panel: panelOpen ? null : "details" })}
            aria-label={`${c.memberCount} members, show details`}
          >
            <UsersRound size={16} /> {c.memberCount}
          </button>
        )}
        <button
          className="icon-btn"
          aria-pressed={panelOpen}
          onClick={() => navigate({ section: route.section, conversationId: id, panel: panelOpen ? null : "details" })}
          aria-label={panelOpen ? "Hide details" : "Show details"}
        >
          <Info size={19} />
        </button>
      </header>

      {(alerts.length > 0 || call || c.archived || history === "running") && (
        <div className="conv-banners">
          {alerts.map((a) => (
            <div key={a.userId} className="banner warn" role="alert">
              <ShieldAlert size={16} />
              <span className="grow">{users[a.userId]?.displayName ?? "Someone"}'s security key changed. Messages to and from them are paused until you review it.</span>
              <button className="btn btn-secondary btn-sm" onClick={() => onDialog({ kind: "identity", userId: a.userId })}>
                Review
              </button>
            </div>
          ))}
          {call && (
            <div className="banner info call-banner">
              {call.video ? <Video size={16} /> : <Phone size={16} />}
              <span className="grow">
                A {call.video ? "video" : "voice"} call is in progress{call.createdAt ? `, started ${relative(call.createdAt)}` : ""}. Join it from Orbit on your phone: calling in the browser isn't
                available yet.
              </span>
            </div>
          )}
          {history === "running" && (
            <div className="banner info">
              <span className="grow">Restoring earlier messages from your encrypted history…</span>
            </div>
          )}
        </div>
      )}

      {loaded ? (
        <MessageList
          conversationId={id}
          items={loaded.items}
          hasMore={loaded.hasMore}
          onLoadOlder={() => engine.loadOlder(id)}
          canPost={c.canPost}
          onReply={setReplyTo}
          onThread={onThread}
          onReview={onReview}
          start={<ConversationStart type={c.type} kind={c.kind} title={title} topic={c.topic} color={peer?.color ?? colorIndexOf(c.id)} />}
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

      <Composer
        conversation={c}
        title={title}
        replyTo={replyTo}
        replyName={replyTo ? (replyTo.outgoing ? "yourself" : (users[replyTo.senderUserId]?.displayName ?? "Unknown")) : null}
        onCancelReply={() => setReplyTo(null)}
        dropped={drop.dropped}
        onDroppedTaken={drop.take}
      />
      {drop.over && <div className="drop-overlay">Drop files to send them, encrypted, to {title}</div>}
    </section>
  );
}
