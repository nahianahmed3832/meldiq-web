import { text as uiText } from "../../i18n";
/** What a voice channel's room page offers (batch B14, android VoiceChannelScreen). */
export interface VoiceRoomInput {
  /** This browser is in this room's call. */
  inThisRoom: boolean;
  /** This browser is in some other call. */
  inAnotherCall: boolean;
  /** voice.connect; false: this person may not join. */
  canConnect: boolean;
  /** voice.speak; false: they may join but only listen. */
  canSpeak: boolean;
  /** Why this browser can't make calls here (no calling on the server, an unsupported browser), or null. */
  callingProblem: string | null;
  archived: boolean;
}
export interface VoiceRoomView {
  action: "join" | "open";
  joinEnabled: boolean;
  /** The permission note above the room. */
  notice: string | null;
  /** Why Join voice is off, when the notice doesn't already say. */
  why: string | null;
}
export function voiceRoom(i: VoiceRoomInput): VoiceRoomView {
  const notice = !i.canConnect ? uiText("calls.interface.you_can_t_join_this_voice_channel_bc52fcf") : !i.canSpeak ? uiText("calls.interface.you_can_listen_here_but_not_speak_5d7d270") : null;
  if (i.inThisRoom) return { action: "open", joinEnabled: false, notice, why: null };
  const why = !i.canConnect
    ? null
    : (i.callingProblem ?? (i.archived ? uiText("workspace.interface.this_channel_is_archived_e078852") : i.inAnotherCall ? uiText("messaging.interface.you_re_already_in_a_call_716b71e") : null));
  return { action: "join", joinEnabled: i.canConnect && why === null, notice, why };
}
