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
  const notice = !i.canConnect ? "You can't join this voice channel." : !i.canSpeak ? "You can listen here, but not speak." : null;
  if (i.inThisRoom) return { action: "open", joinEnabled: false, notice, why: null };
  const why = !i.canConnect ? null : (i.callingProblem ?? (i.archived ? "This channel is archived" : i.inAnotherCall ? "You're already in a call" : null));
  return { action: "join", joinEnabled: i.canConnect && why === null, notice, why };
}
