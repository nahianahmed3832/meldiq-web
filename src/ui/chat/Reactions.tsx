import { useEffect, useId, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import { useEngine, useOrbit } from "../../application/orbit";
import { type ExpressionList, reactionName } from "../../sync/expressions";
import type { StoredMessage } from "../../model/types";
import { useT } from "../../i18n";
import { UserAvatar } from "../components/OrgAvatar";
import { Dialog } from "../components/Overlay";
import { ReactionEmoji } from "../community/CustomEmoji";
import { useLongPress } from "./longPress";
import { previewOf, type Reactor, reactorsOf } from "./reactors";

/** How long the pointer rests on a reaction before its hover card opens (a pass across the row opens nothing). */
const HOVER_DELAY_MS = 250;

interface ReactionListProps {
  message: StoredMessage;
  myUserId: string;
  canPost: boolean;
  communityEmoji: ExpressionList | null;
}

/**
 * A message's reactions. Click or tap toggles yours, as before. Resting the pointer on one, or focusing it with the
 * keyboard, shows who chose it; a long press (touch) or right-click opens the Reactions dialog with everyone, for every
 * reaction. The same component serves DMs, groups and community channels.
 */
export function ReactionList({ message: m, myUserId, canPost, communityEmoji }: ReactionListProps) {
  const [dialogFor, setDialogFor] = useState<string | null>(null);
  const reactions = Object.entries(m.reactions).filter(([, users]) => users.length > 0);
  if (reactions.length === 0) return null;
  return (
    <div className="reactions">
      {reactions.map(([emoji, users]) => (
        <ReactionChip key={emoji} message={m} emoji={emoji} userIds={users} myUserId={myUserId} canPost={canPost} communityEmoji={communityEmoji} onShowAll={() => setDialogFor(emoji)} />
      ))}
      {dialogFor !== null && <ReactionsDialog message={m} initial={dialogFor} myUserId={myUserId} communityEmoji={communityEmoji} onClose={() => setDialogFor(null)} />}
    </div>
  );
}

interface ReactionChipProps {
  message: StoredMessage;
  emoji: string;
  userIds: string[];
  myUserId: string;
  canPost: boolean;
  communityEmoji: ExpressionList | null;
  onShowAll: () => void;
}

function ReactionChip({ message, emoji, userIds, myUserId, canPost, communityEmoji, onShowAll }: ReactionChipProps) {
  const engine = useEngine();
  const t = useT();
  const ref = useRef<HTMLButtonElement>(null);
  const [card, setCard] = useState(false);
  const hover = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cardId = useId();
  const reactors = useReactors(userIds, myUserId, card);
  const mine = userIds.includes(myUserId);
  const press = useLongPress(() => {
    setCard(false);
    onShowAll();
  }, true);
  useEffect(() => () => clearTimeout(hover.current), []);
  useEffect(() => {
    if (!card) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCard(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [card]);

  // The message's own long press and right-click menu don't also open from a reaction.
  const stop =
    <E extends ReactPointerEvent | ReactMouseEvent>(fn: ((e: E) => void) | undefined) =>
    (e: E) => {
      e.stopPropagation();
      fn?.(e);
    };
  const names = reactors.map((r) => r.name).join(", ");
  return (
    <>
      <button
        ref={ref}
        className="reaction"
        aria-pressed={mine}
        disabled={!canPost}
        aria-describedby={card ? cardId : undefined}
        aria-label={t("react_chip_label", { emoji: reactionName(emoji) ?? emoji, n: userIds.length, who: names || String(userIds.length) })}
        onClick={() => void engine.react(message, emoji)}
        onPointerDown={stop(press.onPointerDown)}
        onPointerMove={press.onPointerMove}
        onPointerUp={press.onPointerUp}
        onPointerCancel={press.onPointerCancel}
        onClickCapture={press.onClickCapture}
        onContextMenu={stop(press.onContextMenu)}
        onPointerEnter={(e) => {
          if (e.pointerType !== "mouse") return;
          clearTimeout(hover.current);
          hover.current = setTimeout(() => setCard(true), HOVER_DELAY_MS);
        }}
        onPointerLeave={() => {
          clearTimeout(hover.current);
          setCard(false);
        }}
        onFocus={(e) => e.currentTarget.matches(":focus-visible") && setCard(true)}
        onBlur={() => setCard(false)}
      >
        <span className="reaction-emoji">{reactionName(emoji) ? <ReactionEmoji name={reactionName(emoji)!} list={communityEmoji} /> : emoji}</span>
        {userIds.length}
      </button>
      {card && ref.current && <ReactorCard id={cardId} anchor={ref.current} emoji={emoji} communityEmoji={communityEmoji} reactors={reactors} />}
    </>
  );
}

/** The people behind [userIds], fetching any this browser hasn't loaded yet while [active]. */
function useReactors(userIds: string[], myUserId: string, active: boolean): Reactor[] {
  const engine = useEngine();
  const t = useT();
  const users = useOrbit((s) => s.users);
  useEffect(() => {
    if (!active) return;
    for (const id of userIds) if (!users[id]) void engine.ensureUser(id);
  }, [active, userIds, users, engine]);
  return reactorsOf(userIds, users, myUserId, t("react_you"), t("react_someone"));
}

interface ReactorCardProps {
  id: string;
  anchor: HTMLElement;
  emoji: string;
  communityEmoji: ExpressionList | null;
  reactors: Reactor[];
}

/** The hover card above a reaction: its emoji, the first names and how many more. */
function ReactorCard({ id, anchor, emoji, communityEmoji, reactors }: ReactorCardProps) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect();
    const el = ref.current;
    const w = el?.offsetWidth ?? 220;
    const h = el?.offsetHeight ?? 80;
    const left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 8));
    const top = r.top - h - 8 < 8 ? r.bottom + 8 : r.top - h - 8;
    setPos({ top, left });
  }, [anchor, reactors.length]);
  const { shown, more } = previewOf(reactors);
  return createPortal(
    <div ref={ref} id={id} role="tooltip" className="reactor-card" style={pos ?? { visibility: "hidden", top: 0, left: 0 }}>
      <span className="reactor-card-emoji" aria-hidden="true">
        {reactionName(emoji) ? <ReactionEmoji name={reactionName(emoji)!} list={communityEmoji} /> : emoji}
      </span>
      <span className="reactor-card-text">
        {t("react_by", { names: shown.map((r) => r.name).join(", ") })}
        {more > 0 && <span className="faint"> {t("react_and_more", { n: more })}</span>}
      </span>
    </div>,
    document.body,
  );
}

interface ReactionsDialogProps {
  message: StoredMessage;
  initial: string | null;
  myUserId: string;
  communityEmoji: ExpressionList | null;
  onClose: () => void;
}

/** Everyone who reacted, one tab per reaction, in a scrolling list: touch screens and long lists. */
export function ReactionsDialog({ message, initial, myUserId, communityEmoji, onClose }: ReactionsDialogProps) {
  const t = useT();
  const live = useOrbit((s) => s.messages[message.conversationId]?.items.find((x) => x.id === message.id) ?? message);
  const reactions = Object.entries(live.reactions).filter(([, users]) => users.length > 0);
  const [tab, setTab] = useState(initial ?? reactions[0]?.[0] ?? null);
  const current = reactions.find(([e]) => e === tab) ?? reactions[0];
  const users = useOrbit((s) => s.users);
  const reactors = useReactors(current?.[1] ?? [], myUserId, true);
  return (
    <Dialog title={t("react_dialog_title")} onClose={onClose}>
      {!current ? (
        <p className="side-quiet">{t("react_none")}</p>
      ) : (
        <>
          <div className="reactor-tabs" role="tablist" aria-label={t("react_dialog_title")}>
            {reactions.map(([emoji, ids]) => (
              <button key={emoji} role="tab" aria-selected={emoji === current[0]} className="reaction" onClick={() => setTab(emoji)}>
                <span className="reaction-emoji">{reactionName(emoji) ? <ReactionEmoji name={reactionName(emoji)!} list={communityEmoji} /> : emoji}</span>
                {ids.length}
              </button>
            ))}
          </div>
          <ul className="reactor-list" role="tabpanel" aria-label={t("react_count", { n: reactors.length })}>
            {reactors.map((r) => (
              <li key={r.id}>
                <UserAvatar userId={r.id} name={r.name} colorIndex={users[r.id]?.avatarColor ?? 0} photoRev={users[r.id]?.photoRev} size={32} decorative />
                <span className="grow ellipsis">{r.name}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Dialog>
  );
}
