import { describe, expect, it } from "vitest";
import type { Call } from "../src/api/schemas";
import { callDuration, callLine, summarize } from "../src/sync/callHistory";
import { birthdayProblem, phoneProblem } from "../src/sync/profile";
import { cleanContact, cleanLocation, describeLocation, fallbackText, osmLink } from "../src/sync/rich";
import { preview } from "../src/sync/rules";
import { baseMime, clock, isVoice, shownDuration, VOICE_MAX_MS, voiceFileName, voiceMime } from "../src/sync/voice";

/** The cases of android CallHistoryTest, against the browser's port. */
const call = (
  o: { by?: string; type?: string; state?: string; answered?: number | null; ended?: number | null; reason?: string | null; attended?: { userId: string; seconds: number }[]; video?: boolean } = {},
): Call => {
  const state = o.state ?? "ENDED";
  return {
    id: "call_1",
    conversationId: "c1",
    conversationType: o.type ?? "DM",
    createdBy: o.by ?? "ann",
    video: o.video ?? false,
    state,
    createdAt: 100_000,
    answeredAt: o.answered ?? null,
    endedAt: state === "ENDED" ? (o.ended === undefined ? 200_000 : o.ended) : null,
    endReason: state === "ENDED" ? (o.reason === undefined ? "hangup" : o.reason) : null,
    ...(o.attended ? { attended: o.attended } : {}),
  };
};

describe("call history (android CallHistoryTest)", () => {
  it("one-to-one outcomes for the caller and the callee", () => {
    const done = call({ answered: 110_000, ended: 235_000 });
    expect(summarize(done, "ann")).toEqual({ outcome: "completed", durationSec: 125, startedBy: "ann", group: false });
    expect(summarize(done, "bob").durationSec).toBe(125);
    const o = (reason: string, me: string) => summarize(call({ reason }), me).outcome;
    expect([o("hangup", "ann"), o("hangup", "bob")]).toEqual(["cancelled", "missed"]);
    expect([o("missed", "ann"), o("missed", "bob")]).toEqual(["no_answer", "missed"]);
    expect([o("declined", "ann"), o("declined", "bob")]).toEqual(["declined", "declined"]);
    expect([o("busy", "ann"), o("busy", "bob")]).toEqual(["busy", "missed"]);
    expect(o("error", "ann")).toBe("failed");
    expect(summarize(call({ state: "ACTIVE", answered: 110_000 }), "bob").outcome).toBe("ongoing");
  });

  it("never invents a duration or makes it negative", () => {
    expect(summarize(call({ reason: "declined" }), "ann").durationSec).toBeUndefined();
    expect(summarize(call({ answered: 110_000, ended: null }), "ann").durationSec).toBeUndefined();
    expect(summarize(call({ state: "ACTIVE", answered: 110_000 }), "ann").durationSec).toBeUndefined();
    expect(summarize(call({ answered: 300_000, ended: 200_000 }), "ann").durationSec).toBe(0);
  });

  it("group calls use who connected", () => {
    const g = call({
      type: "GROUP",
      answered: 105_000,
      reason: "empty",
      attended: [
        { userId: "ann", seconds: 600 },
        { userId: "bob", seconds: 90 },
      ],
    });
    expect(summarize(g, "bob")).toEqual({ outcome: "completed", durationSec: 90, joined: 2, startedBy: "ann", group: true });
    expect(summarize(g, "carol").outcome).toBe("missed");
    expect(summarize(g, "carol", true).outcome).toBe("declined");
    const alone = call({ type: "GROUP", reason: "empty", attended: [{ userId: "ann", seconds: 30 }] });
    expect(summarize(alone, "ann").outcome).toBe("no_answer");
    expect(summarize(alone, "bob").outcome).toBe("missed");
    const old = summarize(call({ type: "GROUP", answered: 105_000 }), "bob");
    expect(old.outcome).toBe("ended");
    expect(old.durationSec).toBeUndefined();
  });

  it("lines say what happened", () => {
    const l = (info: Parameters<typeof callLine>[0], video: boolean, out: boolean) => callLine(info, video, out, "Ann");
    expect(l({ outcome: "completed", durationSec: 125, startedBy: "me", group: false }, false, true)).toEqual({ title: "Outgoing voice call", detail: "2 min 5 s", missed: false });
    const missed = l({ outcome: "missed", startedBy: "ann", group: false }, true, false);
    expect(missed).toMatchObject({ title: "Missed video call", missed: true });
    expect(l({ outcome: "declined", startedBy: "ann", group: false }, true, false).missed).toBe(false);
    expect(l({ outcome: "declined", startedBy: "ann", group: false }, false, false).title).toBe("You declined a voice call");
    expect(l({ outcome: "declined", startedBy: "me", group: false }, false, true).title).toBe("Voice call declined");
    expect(l({ outcome: "completed", durationSec: 3_725, startedBy: "ann", joined: 3, group: true }, true, false)).toEqual({
      title: "Group video call",
      detail: "1 h 2 min · 3 people joined · Started by Ann",
      missed: false,
    });
    expect(l({ outcome: "missed", startedBy: "ann", group: true }, false, false).title).toBe("Missed group voice call");
    expect(l(undefined, false, false).title).toBe("Incoming voice call");
    expect([callDuration(45), callDuration(180), callDuration(7_200)]).toEqual(["45 s", "3 min", "2 h"]);
  });

  it("previews a call entry like the phone's chat list", () => {
    const base = { deleted: false, kind: "call" as const, text: "", attachments: [], rich: null, outgoing: false };
    expect(preview({ ...base, call: { callId: "x", video: false, info: { outcome: "missed", startedBy: "a", group: false } } })).toBe("📞 Missed voice call");
    expect(preview({ ...base, call: { callId: "x", video: false } })).toBe("📞 Voice call");
  });
});

describe("contact cards and locations (android RichRules)", () => {
  it("cleans a contact like the phone and writes the same fallback text", () => {
    const c = cleanContact({ name: "  Ada  ", phones: [" +880 1712 ", "+880 1712", "", "2", "3", "4", "5", "6"], emails: ["a@b.c"] })!;
    expect(c).toEqual({ name: "Ada", phones: ["+880 1712", "2", "3", "4", "5"], emails: ["a@b.c"] });
    expect(fallbackText({ contact: c })).toBe("👤 Ada\n+880 1712\n2\n3\n4\n5\na@b.c");
    expect(cleanContact({ name: "   ", phones: [], emails: [] })).toBeNull();
  });

  it("refuses impossible coordinates and links to OpenStreetMap with six decimals", () => {
    expect(cleanLocation({ lat: 91, lon: 0 })).toBeNull();
    expect(cleanLocation({ lat: Number.NaN, lon: 0 })).toBeNull();
    const l = cleanLocation({ lat: 23.8103321, lon: 90.4125181, accuracyM: 12.7, label: "  Office " })!;
    expect(l).toEqual({ lat: 23.8103321, lon: 90.4125181, accuracyM: 12.7, label: "Office" });
    expect(osmLink(l)).toBe("https://www.openstreetmap.org/?mlat=23.810332&mlon=90.412518#map=16/23.810332/90.412518");
    expect(fallbackText({ location: l })).toBe(`📍 Office\n${osmLink(l)}`);
    expect(describeLocation(l)).toBe("23.81033, 90.41252 · within 12 m");
    expect(cleanLocation({ lat: 1, lon: 1, accuracyM: 1e9 })).toEqual({ lat: 1, lon: 1 });
  });
});

describe("voice messages (android VoiceNotes)", () => {
  it("prefers the phone's own format and falls back to Opus", () => {
    expect(voiceMime((t) => t === "audio/mp4")).toBe("audio/mp4");
    expect(voiceMime((t) => t.startsWith("audio/webm"))).toBe("audio/webm;codecs=opus");
    expect(voiceMime((t) => t === "audio/ogg;codecs=opus")).toBe("audio/ogg;codecs=opus");
    expect(voiceMime(() => false)).toBeNull();
    expect(baseMime("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(voiceFileName("audio/mp4", new Date("2026-10-19T05:06:07Z"))).toBe("voice-20261019-050607.m4a");
  });

  it("plays only attachments marked voice and typed audio, with a clamped length", () => {
    expect(isVoice({ voice: true, mime: "audio/mp4" })).toBe(true);
    expect(isVoice({ voice: true, mime: "text/html" })).toBe(false);
    expect(isVoice({ mime: "audio/mp4" })).toBe(false);
    expect(shownDuration(-5)).toBe(0);
    expect(shownDuration(10 ** 9)).toBe(VOICE_MAX_MS);
    expect([clock(7_000), clock(750_000)]).toEqual(["0:07", "12:30"]);
  });
});

describe("profile fields (server rules)", () => {
  it("accepts birthdays with or without the year, and international phone numbers", () => {
    expect(birthdayProblem("1990-03-14")).toBeNull();
    expect(birthdayProblem("--03-14")).toBeNull();
    expect(birthdayProblem("")).toBeNull();
    expect(birthdayProblem("14/03/1990")).not.toBeNull();
    expect(birthdayProblem("1990-13-01")).not.toBeNull();
    expect(phoneProblem("+880 1712-345678")).toBeNull();
    expect(phoneProblem("01712345678")).not.toBeNull();
  });
});
