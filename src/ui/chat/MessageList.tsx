import { ArrowDown, Hash, Lock, Megaphone, Pencil, UserPlus } from "lucide-react";
import { Fragment, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import type { StoredMessage } from "../../model/types";
import { Avatar } from "../components/Avatar";
import { dayLabel, sameDay } from "../format";
import { MessageItem } from "./MessageItem";
import { TypingIndicator } from "./TypingIndicator";
import { JUMP_EVENT } from "./jump";
import { useT } from "../../i18n";
import { shownName } from "../../sync/communityParity";
import { useCommunityMembers } from "../community/useCommunityMembers";
import { useReadingPosition } from "./useReadingPosition";

const GROUP_MS = 5 * 60_000;

interface MessageListProps {
  conversationId: string;
  items: StoredMessage[];
  hasMore: boolean;
  onLoadOlder: () => Promise<void> | void;
  detached?: boolean;
  historyReady?: boolean;
  /** Position the saved newest messages immediately; read receipts still wait for fresh history. */
  preview?: boolean;
  unreadAfter?: number | null;
  onLoadLatest?: () => Promise<void>;
  onReading?: (atLatest: boolean) => void;
  /** Thread view: shows replies; the main view hides them under their root. */
  threadRoot?: string;
  canPost: boolean;
  /** Reactions and votes (the rules channel lets everyone react); defaults to canPost. */
  canReact?: boolean;
  /** Community parity A1: adding new reactions, and moderating (pin, delete anyone's message). */
  newReactions?: boolean;
  moderate?: boolean;
  onReply: (m: StoredMessage) => void;
  onThread: ((m: StoredMessage) => void) | null;
  onReview: (userId: string) => void;
  start?: ReactNode;
  /**
   * Other things to show among the messages, in time order, each drawn by its own component. Main view only, never in a
   * thread.
   */
  extras?: TimelineExtra[];
}

export interface TimelineExtra {
  id: string;
  at: number;
  /** Written by this person: the list follows it to the bottom, as it does for their own messages. */
  mine: boolean;
  node: ReactNode;
}

type Entry = { kind: "msg"; id: string; at: number; m: StoredMessage } | { kind: "extra"; id: string; at: number; e: TimelineExtra };

export function MessageList(props: MessageListProps) {
  const engine = useEngine();
  const threadRev = useOrbit((s) => s.threadRev);
  const serverCounts = useOrbit((s) => s.serverThreadCounts[props.conversationId]);
  useEffect(() => {
    void engine.refreshThreadCounts(props.conversationId);
  }, [engine, props.conversationId, threadRev]);
  const { items, threadRoot, hasMore, onLoadOlder } = props;
  const me = useOrbit((s) => s.me);
  const users = useOrbit((s) => s.users);
  const typing = useOrbit((s) => s.typing[props.conversationId]);
  // Community parity A1: people go by their nickname in a community's channels.
  const communityId = useOrbit((s) => {
    const c = s.conversations[props.conversationId];
    return c?.type === "CHANNEL" ? c.orgId : null;
  });
  const { nicknames } = useCommunityMembers(communityId);
  const [highlight, setHighlight] = useState<string | null>(null);
  const loading = useRef(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loadingLatest, setLoadingLatest] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [, tick] = useState(0);

  const visible = useMemo(() => (threadRoot ? items.filter((m) => m.id === threadRoot || m.threadRootId === threadRoot) : items.filter((m) => !m.threadRootId)), [items, threadRoot]);
  const threadCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of items) if (m.threadRootId && !m.deleted) counts.set(m.threadRootId, (counts.get(m.threadRootId) ?? 0) + 1);
    return counts;
  }, [items]);
  const byId = useMemo(() => new Map(items.map((m) => [m.id, m])), [items]);
  const extras = props.extras;
  // Messages and extras by time; sorting is stable, so messages keep their own order.
  const timeline = useMemo<Entry[]>(() => {
    const out: Entry[] = visible.map((m) => ({ kind: "msg", id: m.id, at: m.sortTs, m }));
    if (threadRoot || !extras?.length) return out;
    for (const e of extras) out.push({ kind: "extra", id: `x-${e.id}`, at: e.at, e });
    return out.sort((a, b) => a.at - b.at);
  }, [visible, extras, threadRoot]);

  const unreadId = props.unreadAfter != null ? visible.find((m) => !m.outgoing && (m.serverTs ?? m.sortTs) > props.unreadAfter!)?.id : undefined;
  const positionEntries = useMemo(() => timeline.map((entry) => ({ id: entry.id, mine: entry.kind === "msg" ? entry.m.outgoing : entry.e.mine })), [timeline]);
  const position = useReadingPosition({
    entries: positionEntries,
    ready: props.preview || (props.historyReady ?? true),
    detached: props.detached,
    onReading: props.historyReady === false ? undefined : props.onReading,
  });
  const { scroller } = position;
  const loadOlder = useCallback(async () => {
    if (loading.current || !hasMore) return;
    loading.current = true;
    setLoadingOlder(true);
    try {
      await onLoadOlder();
    } finally {
      loading.current = false;
      setLoadingOlder(false);
    }
  }, [hasMore, onLoadOlder]);
  const onScroll = () => {
    const reading = position.onScroll();
    if (reading && scroller.current && scroller.current.scrollTop < 200) void loadOlder();
  };
  const toLatest = async () => {
    if (loadingLatest) return;
    setLoadError(null);
    setLoadingLatest(true);
    try {
      if (props.detached) await props.onLoadLatest?.();
      position.latest();
    } catch {
      setLoadError("Couldn't load the latest messages. Try again.");
    } finally {
      setLoadingLatest(false);
    }
  };

  // Typing indicators expire on their own.
  useEffect(() => {
    if (!typing) return;
    const t = setInterval(() => tick((n) => n + 1), 2000);
    return () => clearInterval(t);
  }, [typing]);

  const jump = useCallback(
    (id: string) => {
      const el = Array.from(scroller.current?.querySelectorAll<HTMLElement>("[id^='msg-']") ?? []).find((node) => node.id === `msg-${id}`);
      if (!el) return;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.focus({ preventScroll: true });
      setHighlight(id);
      setTimeout(() => setHighlight(null), 1700);
    },
    [scroller],
  );
  // A search result chosen in the side panel (after it loaded the message): shown once the list has rendered it.
  useEffect(() => {
    const onJump = (e: Event) => requestAnimationFrame(() => jump((e as CustomEvent<string>).detail));
    window.addEventListener(JUMP_EVENT, onJump);
    return () => window.removeEventListener(JUMP_EVENT, onJump);
  }, [jump]);

  if (!me) return null;
  const nameOf = (id: string) => shownName(id === me.userId ? me.displayName : (users[id]?.displayName ?? "Unknown"), nicknames.get(id));
  const typers = Object.entries(typing ?? {})
    .filter(([u, until]) => until > Date.now() && u !== me.userId)
    .map(([u]) => users[u]?.displayName ?? "Someone");

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div ref={scroller} className="messages scroll" onScroll={onScroll} role="log" aria-busy={props.historyReady === false} aria-live="polite" aria-relevant="additions" aria-label="Messages">
        {props.hasMore ? (
          <div className="load-older">
            <button className="btn btn-ghost btn-sm" disabled={loadingOlder} onClick={() => void loadOlder()}>
              {loadingOlder ? "Loading earlier messages…" : "Load earlier messages"}
            </button>
          </div>
        ) : (
          props.historyReady !== false && props.start
        )}
        {timeline.map((entry, i) => {
          const prevEntry = timeline[i - 1];
          const newDay = !prevEntry || !sameDay(prevEntry.at, entry.at);
          if (entry.kind === "extra") {
            return (
              <Fragment key={entry.id}>
                {newDay && (
                  <div className="day" role="separator">
                    <span>{dayLabel(entry.at)}</span>
                  </div>
                )}
                {entry.e.node}
              </Fragment>
            );
          }
          const m = entry.m;
          // A message right after an extra starts its own group (name and avatar shown again).
          const before = prevEntry?.kind === "msg" ? prevEntry.m : undefined;
          const first =
            newDay ||
            !before ||
            before.senderUserId !== m.senderUserId ||
            m.sortTs - before.sortTs > GROUP_MS ||
            before.kind !== "text" ||
            m.kind !== "text" ||
            // A webhook post may carry its own name each time (community parity C).
            before.rich?.webhook?.name !== m.rich?.webhook?.name ||
            (!!threadRoot && before.id === threadRoot);
          const reply = m.replyToId ? byId.get(m.replyToId) : undefined;
          const mentionNames = new Set(
            m.mentions
              .map((id) => (id === me.userId ? me.username : users[id]?.username))
              .filter((x): x is string => !!x)
              .map((x) => x.toLowerCase()),
          );
          return (
            <Fragment key={m.id}>
              {newDay && (
                <div className="day" role="separator">
                  <span>{dayLabel(m.sortTs)}</span>
                </div>
              )}
              {m.id === unreadId && (
                <div className="day unread-divider" role="separator" aria-label="New messages">
                  <span>New messages</span>
                </div>
              )}
              <MessageItem
                m={m}
                first={first}
                senderName={nameOf(m.outgoing ? me.userId : m.senderUserId)}
                senderColor={m.outgoing ? me.avatarColor : (users[m.senderUserId]?.avatarColor ?? 0)}
                senderPhotoRev={users[m.outgoing ? me.userId : m.senderUserId]?.photoRev}
                myUserId={me.userId}
                myUsername={me.username}
                mentionNames={mentionNames}
                replyTo={reply ? { id: reply.id, name: reply.outgoing ? "You" : nameOf(reply.senderUserId), text: reply.deleted ? "Deleted message" : reply.text } : null}
                threadCount={threadRoot ? 0 : (serverCounts?.[m.id] ?? threadCounts.get(m.id) ?? 0)}
                canPost={props.canPost}
                canReact={props.canReact ?? props.canPost}
                newReactions={props.newReactions}
                moderate={props.moderate}
                highlighted={highlight === m.id}
                onReply={props.onReply}
                onThread={threadRoot ? null : props.onThread}
                onJump={jump}
                onReview={() => props.onReview(m.conversationId)}
              />
            </Fragment>
          );
        })}
      </div>
      <TypingIndicator names={typers} />
      {loadError && (
        <div className="banner danger" role="alert">
          {loadError}
        </div>
      )}
      {(position.away || position.unseen > 0 || props.detached) && (
        <button className="btn btn-primary btn-sm jump-latest" disabled={loadingLatest} onClick={() => void toLatest()}>
          <ArrowDown size={14} /> {loadingLatest ? "Loading latest…" : position.unseen > 0 ? `${position.unseen} new ${position.unseen === 1 ? "message" : "messages"}` : "Jump to latest"}
        </button>
      )}
    </div>
  );
}

/** "This is the beginning of …": shown above the oldest message once there's nothing earlier. */
export function ConversationStart({
  type,
  kind,
  title,
  topic,
  color,
  avatar,
  onManage,
}: {
  type: string;
  kind: string | null;
  title: string;
  topic: string | null;
  color: number;
  /** The DM peer's or the group's own avatar (with its photo); initials otherwise. */
  avatar?: ReactNode;
  /** Round 3 (the reference's "Add description" / "Add people"): opens the channel's details, for its managers. */
  onManage?: () => void;
}) {
  const t = useT();
  return (
    <div className="conv-start">
      {type === "CHANNEL" ? (
        <span className="empty-orb" style={{ width: 52, height: 52 }}>
          {kind === "PRIVATE" ? <Lock size={22} /> : kind === "ANNOUNCEMENT" ? <Megaphone size={22} /> : <Hash size={24} />}
        </span>
      ) : (
        (avatar ?? <Avatar name={title} colorIndex={color} size={52} decorative />)
      )}
      <h2>{type === "CHANNEL" ? t("start_welcome", { name: title }) : title}</h2>
      <p>{type === "CHANNEL" ? (topic ?? t("start_channel")) : type === "DM" ? t("start_dm", { name: title }) : t("start_group")}</p>
      <p className="faint" style={{ fontSize: 12.5 }}>
        {t("start_history")}
      </p>
      {onManage && (
        <div className="row" style={{ gap: 8, justifyContent: "center" }}>
          <button className="btn btn-secondary btn-sm" onClick={onManage}>
            <Pencil size={14} /> {t("start_add_description")}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onManage}>
            <UserPlus size={14} /> {t("start_add_people")}
          </button>
        </div>
      )}
    </div>
  );
}
