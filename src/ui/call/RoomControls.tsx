import { Hand, MicOff, MoreHorizontal, UsersRound } from "lucide-react";
import { useEngine } from "../../application/orbit";
import type { ModerationAction } from "../../call/manager";
import type { CallParticipantView, CallUiState } from "../../call/types";
import { Menu, type MenuEntry, useMenu } from "../components/Overlay";

/**
 * Voice rooms on the call screen (docs/VOICE_ROOMS.md; android CallOverlay): Raise hand, and the People list with raised
 * hands first, where the room's managers can mute someone's microphone, lower their hand or remove them from the call.
 * The server checks every action again.
 */
export function HandButton({ call }: { call: CallUiState }) {
  const engine = useEngine();
  const me = call.participants.find((p) => p.isLocal)?.userId;
  const raised = !!me && call.hands.includes(me);
  return (
    <button
      className={`call-btn${raised ? " on" : ""}`}
      onClick={() => void engine.calls.raiseHand(!raised)}
      aria-pressed={raised}
      aria-label={raised ? "Lower your hand" : "Raise your hand"}
      title={raised ? "Lower hand" : "Raise hand"}
      disabled={call.phase !== "connected"}
    >
      <Hand size={22} />
    </button>
  );
}

export function PeopleButton({ open, onToggle, count }: { open: boolean; onToggle: () => void; count: number }) {
  return (
    <button className={`call-btn${open ? " on" : ""}`} onClick={onToggle} aria-pressed={open} aria-label={`People in the room (${count})`} title="People">
      <UsersRound size={22} />
    </button>
  );
}

/** One row per person (a person may be in the room from two devices), raised hands first, in the order they went up. */
export function roomRows(call: CallUiState): CallParticipantView[] {
  const seen = new Map<string, CallParticipantView>();
  for (const p of call.participants) if (!seen.has(p.userId) || p.isLocal) seen.set(p.userId, p);
  const order = (p: CallParticipantView) => {
    const i = call.hands.indexOf(p.userId);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...seen.values()].sort((a, b) => order(a) - order(b));
}

export function RoomPeople({ call }: { call: CallUiState }) {
  const rows = roomRows(call);
  return (
    <section className="room-people" aria-label="People in the room">
      <h3>
        People · {rows.length}
        {call.hands.length > 0 && <span className="hands"> · {call.hands.length === 1 ? "1 hand raised" : `${call.hands.length} hands raised`}</span>}
      </h3>
      <ul>
        {rows.map((p) => (
          <PersonRow key={p.userId} p={p} raised={call.hands.includes(p.userId)} canModerate={call.canModerate} />
        ))}
      </ul>
    </section>
  );
}

function PersonRow({ p, raised, canModerate }: { p: CallParticipantView; raised: boolean; canModerate: boolean }) {
  const engine = useEngine();
  const menu = useMenu();
  const act = (action: ModerationAction) => () => void engine.calls.moderate(p.userId, action);
  const entries: MenuEntry[] = [
    { label: "Mute microphone", onSelect: act("mute") },
    ...(raised ? [{ label: "Lower hand", onSelect: act("lower_hand") }] : []),
    { label: "Remove from call", onSelect: act("remove"), danger: true },
  ];
  return (
    <li>
      {raised && <Hand size={15} className="hand" aria-label="Hand raised" />}
      <span className="grow ellipsis">{p.isLocal ? "You" : p.name}</span>
      {!p.micOn && <MicOff size={14} aria-label="Microphone off" />}
      {canModerate && !p.isLocal && (
        <>
          <button className="icon-btn" aria-label={`Moderate ${p.name}`} aria-haspopup="menu" onClick={(e) => menu.open(e.currentTarget)}>
            <MoreHorizontal size={16} />
          </button>
          {menu.anchor && <Menu anchor={menu.anchor} label={`Moderate ${p.name}`} onClose={menu.close} entries={entries} />}
        </>
      )}
    </li>
  );
}
