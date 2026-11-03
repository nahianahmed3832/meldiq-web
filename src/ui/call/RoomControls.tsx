import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Hand, MicOff, MoreHorizontal, UsersRound } from "lucide-react";
import { useEngine } from "../../application/orbit";
import type { ModerationAction } from "../../call/manager";
import type { CallParticipantView, CallUiState } from "../../call/types";
import { Menu, type MenuEntry, useMenu } from "../components/Overlay";
import { useVoiceModeration, type VoiceModeration } from "./voiceModeration";
/**
 * Voice rooms on the call screen (docs/VOICE_ROOMS.md; android CallOverlay): Raise hand, and the People list with raised
 * hands first, where the room's managers can mute someone's microphone, lower their hand or remove them from the call.
 * The server checks every action again.
 */
export function HandButton({ call }: { call: CallUiState }) {
  useLocaleRender();
  const engine = useEngine();
  const me = call.participants.find((p) => p.isLocal)?.userId;
  const raised = !!me && call.hands.includes(me);
  return (
    <button
      className={`call-btn${raised ? " on" : ""}`}
      onClick={() => void engine.calls.raiseHand(!raised)}
      aria-pressed={raised}
      aria-label={raised ? uiText("calls.interface.lower_your_hand_b8308c2") : uiText("calls.interface.raise_your_hand_a7d9af4")}
      title={raised ? uiText("calls.interface.lower_hand_e975d28") : uiText("calls.interface.raise_hand_fdde0eb")}
      disabled={call.phase !== "connected"}
    >
      <Hand size={22} />
    </button>
  );
}
export function PeopleButton({ open, onToggle, count }: { open: boolean; onToggle: () => void; count: number }) {
  useLocaleRender();
  return (
    <button
      className={`call-btn${open ? " on" : ""}`}
      onClick={onToggle}
      aria-pressed={open}
      aria-label={uiText("calls.interface.people_in_the_room_value0_00e146c", { value0: count })}
      title={uiText("calls.interface.people_7db2089")}
    >
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
  useLocaleRender();
  const rows = roomRows(call);
  const mod = useVoiceModeration(call);
  return (
    <section className="room-people" aria-label={uiText("calls.interface.people_in_the_room_61df741")}>
      <h3>
        <Localized
          k="calls.interface.people_ce09a18"
          slots={[
            rows.length,
            call.hands.length > 0 && (
              <span className="hands">
                {" "}
                · {call.hands.length === 1 ? uiText("calls.interface.1_hand_raised_dc6853c") : uiText("calls.interface.value0_hands_raised_37daee4", { value0: call.hands.length })}
              </span>
            ),
          ]}
        />
      </h3>
      {mod.stage && (
        <p className="stage-label">{mod.stageModerator ? uiText("calls.interface.stage_bring_people_up_to_speak_5f0efaa") : uiText("calls.interface.stage_raise_your_hand_to_ask_to_speak_1e931ce")}</p>
      )}
      <ul>
        {rows.map((p) => (
          <PersonRow key={p.userId} p={p} raised={call.hands.includes(p.userId)} canModerate={call.canModerate} mod={mod} />
        ))}
      </ul>
    </section>
  );
}
function PersonRow({ p, raised, canModerate, mod }: { p: CallParticipantView; raised: boolean; canModerate: boolean; mod: VoiceModeration }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const menu = useMenu();
  const act = (action: ModerationAction) => () => void engine.calls.moderate(p.userId, action);
  const extra = mod.entriesFor(p);
  const entries: MenuEntry[] = [
    ...(canModerate
      ? [
          {
            get label() {
              return uiText("calls.muteMicrophone");
            },
            onSelect: act("mute"),
          },
          ...(raised
            ? [
                {
                  get label() {
                    return uiText("calls.interface.lower_hand_e975d28");
                  },
                  onSelect: act("lower_hand"),
                },
              ]
            : []),
          {
            get label() {
              return uiText("calls.interface.remove_from_call_5979603");
            },
            onSelect: act("remove"),
            danger: true,
          },
        ]
      : []),
    ...(canModerate && extra.length ? ["separator" as const] : []),
    ...extra,
  ];
  return (
    <li>
      {raised && <Hand size={15} className="hand" aria-label={uiText("calls.interface.hand_raised_28a8168")} />}
      <span className="grow ellipsis">{p.isLocal ? l10n("workspace.nav_you") : p.name}</span>
      {mod.stage && mod.speakerIds.includes(p.userId) && (
        <span className="tag">
          <Localized k="calls.interface.speaker_a9e0c70" />
        </span>
      )}
      {!p.micOn && <MicOff size={14} aria-label={uiText("calls.interface.microphone_off_1bcbbc1")} />}
      {entries.length > 0 && !p.isLocal && (
        <>
          <button className="icon-btn" aria-label={uiText("calls.interface.moderate_value0_cb0600a", { value0: p.name })} aria-haspopup="menu" onClick={(e) => menu.open(e.currentTarget)}>
            <MoreHorizontal size={16} />
          </button>
          {menu.anchor && <Menu anchor={menu.anchor} label={uiText("calls.interface.moderate_value0_cb0600a", { value0: p.name })} onClose={menu.close} entries={entries} />}
        </>
      )}
    </li>
  );
}
