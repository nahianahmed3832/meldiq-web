import { describe, expect, it } from "vitest";
import { voiceRoom } from "../src/ui/chat/voiceRoomRules";

const base = { inThisRoom: false, inAnotherCall: false, canConnect: true, canSpeak: true, callingProblem: null, archived: false };

describe("voice channel room (batch B14, android VoiceChannelScreen)", () => {
  it("offers Join voice when nothing is in the way", () => {
    expect(voiceRoom(base)).toEqual({ action: "join", joinEnabled: true, notice: null, why: null });
  });

  it("offers Open the call when this browser is already in the room", () => {
    expect(voiceRoom({ ...base, inThisRoom: true })).toMatchObject({ action: "open", joinEnabled: false });
  });

  it("says when you may only listen, and still lets you join", () => {
    expect(voiceRoom({ ...base, canSpeak: false })).toEqual({ action: "join", joinEnabled: true, notice: "You can listen here, but not speak.", why: null });
  });

  it("can't be joined without voice.connect, and says so instead of the listen-only note", () => {
    expect(voiceRoom({ ...base, canConnect: false, canSpeak: false })).toEqual({ action: "join", joinEnabled: false, notice: "You can't join this voice channel.", why: null });
  });

  it("says why it can't be joined: calling not set up, another call, or archived", () => {
    expect(voiceRoom({ ...base, callingProblem: "Calling isn't set up on this server" })).toMatchObject({ joinEnabled: false, why: "Calling isn't set up on this server" });
    expect(voiceRoom({ ...base, inAnotherCall: true })).toMatchObject({ joinEnabled: false, why: "You're already in a call" });
    expect(voiceRoom({ ...base, archived: true })).toMatchObject({ joinEnabled: false, why: "This channel is archived" });
  });
});
