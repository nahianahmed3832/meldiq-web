import type { Call } from "../api/schemas";
import type { CallInfo } from "../model/types";

/**
 * Call history lines in conversations (docs/CALL_HISTORY.md; android CallHistory.kt, tested against its cases). The
 * outcome comes only from the server's record: who started the call, whether and when it was answered, when and why it
 * ended, and who connected. A duration is shown only when both of its ends were recorded.
 */
export function summarize(call: Call, me: string, declinedHere = false): CallInfo {
  const group = !!call.conversationType && call.conversationType !== "DM";
  const mine = call.createdBy === me;
  const base = { startedBy: call.createdBy, group };
  if (call.state !== "ENDED") return { ...base, outcome: "ongoing" };
  const reason = call.endReason;
  const failed = reason === "error" || reason === "lost" || reason === "removed";
  const answeredAt = call.answeredAt ?? null;
  if (group) {
    if (!call.attended) return { ...base, outcome: "ended" };
    const people = new Set(call.attended.map((a) => a.userId)).size;
    const myTime = call.attended.filter((a) => a.userId === me);
    if (myTime.length && answeredAt !== null)
      return {
        ...base,
        outcome: "completed",
        durationSec: Math.max(
          0,
          myTime.reduce((n, a) => n + a.seconds, 0),
        ),
        joined: people,
      };
    if (myTime.length) return { ...base, outcome: "no_answer", joined: people };
    if (declinedHere) return { ...base, outcome: "declined", joined: people };
    if (mine) return { ...base, outcome: failed ? "failed" : "cancelled", joined: people };
    return { ...base, outcome: "missed", joined: people };
  }
  if (answeredAt !== null) {
    return { ...base, outcome: "completed", ...(call.endedAt !== null ? { durationSec: Math.max(0, Math.trunc((call.endedAt - answeredAt) / 1000)) } : {}) };
  }
  if (mine) {
    const outcome = reason === "declined" ? "declined" : reason === "busy" ? "busy" : reason === "missed" ? "no_answer" : failed ? "failed" : "cancelled";
    return { ...base, outcome };
  }
  return { ...base, outcome: reason === "declined" || declinedHere ? "declined" : "missed" };
}

export interface CallLine {
  title: string;
  detail: string | null;
  missed: boolean;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "45 s", "2 min 5 s", "1 h 2 min". */
export function callDuration(sec: number): string {
  const s = Math.max(0, Math.trunc(sec));
  if (s < 60) return `${s} s`;
  if (s < 3600) return s % 60 === 0 ? `${s / 60} min` : `${Math.floor(s / 60)} min ${s % 60} s`;
  const min = Math.floor((s % 3600) / 60);
  return min === 0 ? `${Math.floor(s / 3600)} h` : `${Math.floor(s / 3600)} h ${min} min`;
}

/** What the conversation shows for a call. [outgoing]: this account started it; [starter]: their name (groups). */
export function callLine(info: CallInfo | undefined, video: boolean, outgoing: boolean, starter: string | null): CallLine {
  const kind = video ? "video call" : "voice call";
  if (!info) return { title: `${outgoing ? "Outgoing" : "Incoming"} ${kind}`, detail: null, missed: false };
  const groupKind = info.group ? `group ${kind}` : kind;
  const duration = info.durationSec !== undefined ? callDuration(info.durationSec) : null;
  const joined = info.group && info.joined ? (info.joined === 1 ? "1 person joined" : `${info.joined} people joined`) : null;
  const by = info.group && !outgoing && starter ? `Started by ${starter}` : null;
  switch (info.outcome) {
    case "completed":
      return { title: info.group ? cap(groupKind) : `${outgoing ? "Outgoing" : "Incoming"} ${kind}`, detail: [duration, joined, by].filter(Boolean).join(" · ") || null, missed: false };
    case "missed":
      return { title: `Missed ${groupKind}`, detail: by, missed: true };
    case "declined":
      return { title: outgoing ? `${cap(kind)} declined` : `You declined a ${groupKind}`, detail: by, missed: false };
    case "busy":
      return { title: `${cap(kind)} not answered`, detail: "They were on another call", missed: false };
    case "no_answer":
      return { title: info.group ? `${cap(groupKind)} · no one joined` : `${cap(kind)} · no answer`, detail: by, missed: false };
    case "cancelled":
      return { title: `Cancelled ${groupKind}`, detail: by, missed: false };
    case "failed":
      return { title: `${cap(groupKind)} failed`, detail: "The call couldn't be connected", missed: false };
    case "ongoing":
      return { title: `${cap(groupKind)} in progress`, detail: by, missed: false };
    case "ended":
      return { title: `${cap(groupKind)} ended`, detail: by, missed: false };
  }
}
