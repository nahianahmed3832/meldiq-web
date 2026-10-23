import { ArrowDown, Hash, Lock, Megaphone, Pencil, UserPlus } from "lucide-react";
import { Fragment, type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useOrbit } from "../../application/orbit";
import type { StoredMessage } from "../../model/types";
import { Avatar } from "../components/Avatar";
import { dayLabel, sameDay } from "../format";
import { MessageItem } from "./MessageItem";
import { JUMP_EVENT } from "./jump";
import { useT } from "../../i18n";

const GROUP_MS = 5 * 60_000;
const NEAR_BOTTOM = 120;

interface MessageListProps {
  conversationId: string;
  items: StoredMessage[];
  hasMore: boolean;
  onLoadOlder: () => Promise<void> | void;
  /** Thread view: shows replies; the main view hides them under their root. */
  threadRoot?: string;
  canPost: boolean;
  onReply: (m: StoredMessage) => void;
  onThread: ((m: StoredMessage) => void) | null;
  onReview: (userId: string) => void;
  start?: ReactNode;
}

export function MessageList(props: MessageListProps) {
  const { items, threadRoot } = props;
  const me = useOrbit((s) => s.me);
  const users = useOrbit((s) => s.users);
  const typing = useOrbit((s) => s.typing[props.conversationId]);
  const scroller = useRef<HTMLDivElement>(null);
  const prev = useRef<{ first: string | null; last: string | null; height: number; atBottom: boolean }>({ first: null, last: null, height: 0, atBottom: true });
  const [unseen, setUnseen] = useState(0);
  const [highlight, setHighlight] = useState<string | null>(null);
  const loading = useRef(false);
  const [, tick] = useState(0);

  const visible = useMemo(() => (threadRoot ? items.filter((m) => m.id === threadRoot || m.threadRootId === threadRoot) : items.filter((m) => !m.threadRootId)), [items, threadRoot]);
  const threadCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of items) if (m.threadRootId && !m.deleted) counts.set(m.threadRootId, (counts.get(m.threadRootId) ?? 0) + 1);
    return counts;
  }, [items]);
  const byId = useMemo(() => new Map(items.map((m) => [m.id, m])), [items]);

  const isNearBottom = () => {
    const el = scroller.current;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM;
  };

  // Keep the reader's place: pinned to the newest message when they were there, unchanged when older pages load.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const first = visible[0]?.id ?? null;
    const last = visible[visible.length - 1]?.id ?? null;
    const p = prev.current;
    if (p.first === null && p.last === null) el.scrollTop = el.scrollHeight;
    else if (first !== p.first && last === p.last) el.scrollTop += el.scrollHeight - p.height;
    else if (last !== p.last) {
      const lastMsg = visible[visible.length - 1];
      if (p.atBottom || lastMsg?.outgoing) {
        el.scrollTop = el.scrollHeight;
        setUnseen(0);
      } else setUnseen((n) => n + 1);
    }
    prev.current = { first, last, height: el.scrollHeight, atBottom: isNearBottom() };
  }, [visible]);

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    prev.current = { ...prev.current, height: el.scrollHeight, atBottom: isNearBottom() };
    if (prev.current.atBottom) setUnseen(0);
    if (el.scrollTop < 200 && props.hasMore && !loading.current) {
      loading.current = true;
      void Promise.resolve(props.onLoadOlder()).finally(() => (loading.current = false));
    }
  }, [props]);

  // Images load after layout: stay at the bottom if that's where the reader is.
  useEffect(() => {
    const el = scroller.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (prev.current.atBottom) el.scrollTop = el.scrollHeight;
    });
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => ro.disconnect();
  }, [visible.length]);

  // Typing indicators expire on their own.
  useEffect(() => {
    if (!typing) return;
    const t = setInterval(() => tick((n) => n + 1), 2000);
    return () => clearInterval(t);
  }, [typing]);

  const jump = useCallback((id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.focus({ preventScroll: true });
    setHighlight(id);
    setTimeout(() => setHighlight(null), 1700);
  }, []);
  // A search result chosen in the side panel (after it loaded the message): shown once the list has rendered it.
  useEffect(() => {
    const onJump = (e: Event) => requestAnimationFrame(() => jump((e as CustomEvent<string>).detail));
    window.addEventListener(JUMP_EVENT, onJump);
    return () => window.removeEventListener(JUMP_EVENT, onJump);
  }, [jump]);

  if (!me) return null;
  const nameOf = (id: string) => (id === me.userId ? me.displayName : (users[id]?.displayName ?? "Unknown"));
  const typers = Object.entries(typing ?? {})
    .filter(([u, until]) => until > Date.now() && u !== me.userId)
    .map(([u]) => users[u]?.displayName ?? "Someone");

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div ref={scroller} className="messages scroll" onScroll={onScroll} role="log" aria-live="polite" aria-relevant="additions" aria-label="Messages">
        {props.hasMore ? (
          <div className="load-older">
            <button className="btn btn-ghost btn-sm" onClick={() => void props.onLoadOlder()}>
              Load earlier messages
            </button>
          </div>
        ) : (
          props.start
        )}
        {visible.map((m, i) => {
          const before = visible[i - 1];
          const newDay = !before || !sameDay(before.sortTs, m.sortTs);
          const first =
            newDay ||
            !before ||
            before.senderUserId !== m.senderUserId ||
            m.sortTs - before.sortTs > GROUP_MS ||
            before.kind !== "text" ||
            m.kind !== "text" ||
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
              <MessageItem
                m={m}
                first={first}
                senderName={m.outgoing ? me.displayName : nameOf(m.senderUserId)}
                senderColor={m.outgoing ? me.avatarColor : (users[m.senderUserId]?.avatarColor ?? 0)}
                senderPhotoRev={users[m.outgoing ? me.userId : m.senderUserId]?.photoRev}
                myUserId={me.userId}
                myUsername={me.username}
                mentionNames={mentionNames}
                replyTo={reply ? { id: reply.id, name: reply.outgoing ? "You" : nameOf(reply.senderUserId), text: reply.deleted ? "Deleted message" : reply.text } : null}
                threadCount={threadRoot ? 0 : (threadCounts.get(m.id) ?? 0)}
                canPost={props.canPost}
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
      <div className="typing" aria-live="polite">
        {typers.length > 0 && (
          <>
            <span className="typing-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            {`${typers.slice(0, 2).join(" and ")}${typers.length > 2 ? " and others" : ""} ${typers.length === 1 ? "is" : "are"} typing…`}
          </>
        )}
      </div>
      {unseen > 0 && (
        <button
          className="btn btn-primary btn-sm jump-latest"
          onClick={() => {
            const el = scroller.current;
            if (el) el.scrollTop = el.scrollHeight;
            setUnseen(0);
          }}
        >
          <ArrowDown size={14} /> {unseen} new {unseen === 1 ? "message" : "messages"}
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
