import { formatMeasure } from "../i18n/format";
import { text as uiText } from "../i18n";
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
  if (s < 60) return formatMeasure(s, "second");
  if (s < 3600) return [formatMeasure(Math.floor(s / 60), "minute"), s % 60 ? formatMeasure(s % 60, "second") : ""].filter(Boolean).join(" ");
  const min = Math.floor((s % 3600) / 60);
  return [formatMeasure(Math.floor(s / 3600), "hour"), min ? formatMeasure(min, "minute") : ""].filter(Boolean).join(" ");
}
/** What the conversation shows for a call. [outgoing]: this account started it; [starter]: their name (groups). */
export function callLine(info: CallInfo | undefined, video: boolean, outgoing: boolean, starter: string | null): CallLine {
  const kind = video ? uiText("calls.interface.video_call_89e4267") : uiText("calls.interface.voice_call_3cb651f");
  if (!info) return { title: `${outgoing ? uiText("calls.interface.outgoing_3619cf0") : uiText("calls.interface.incoming_e301820")} ${kind}`, detail: null, missed: false };
  const groupKind = info.group ? uiText("calls.interface.group_value0_26ac745", { value0: kind }) : kind;
  const duration = info.durationSec !== undefined ? callDuration(info.durationSec) : null;
  const joined =
    info.group && info.joined ? (info.joined === 1 ? uiText("calls.interface.1_person_joined_9bb3a07") : uiText("calls.interface.value0_people_joined_26b0e3b", { value0: info.joined })) : null;
  const by = info.group && !outgoing && starter ? uiText("calls.interface.started_by_value0_2f9bd66", { value0: starter }) : null;
  switch (info.outcome) {
    case "completed":
      return {
        title: info.group ? cap(groupKind) : `${outgoing ? uiText("calls.interface.outgoing_3619cf0") : uiText("calls.interface.incoming_e301820")} ${kind}`,
        detail: [duration, joined, by].filter(Boolean).join(" · ") || null,
        missed: false,
      };
    case "missed":
      return { title: uiText("calls.interface.missed_value0_03858e1", { value0: groupKind }), detail: by, missed: true };
    case "declined":
      return {
        title: outgoing ? uiText("calls.interface.value0_declined_ad88d6d", { value0: cap(kind) }) : uiText("calls.interface.you_declined_a_value0_4e43e38", { value0: groupKind }),
        detail: by,
        missed: false,
      };
    case "busy":
      return { title: uiText("calls.interface.value0_not_answered_fd375d8", { value0: cap(kind) }), detail: uiText("calls.interface.they_were_on_another_call_7350533"), missed: false };
    case "no_answer":
      return {
        title: info.group ? uiText("calls.interface.value0_no_one_joined_2c73f97", { value0: cap(groupKind) }) : uiText("calls.interface.value0_no_answer_08abf93", { value0: cap(kind) }),
        detail: by,
        missed: false,
      };
    case "cancelled":
      return { title: uiText("calls.interface.cancelled_value0_34b29c7", { value0: groupKind }), detail: by, missed: false };
    case "failed":
      return { title: uiText("calls.interface.value0_failed_afc8311", { value0: cap(groupKind) }), detail: uiText("calls.interface.the_call_couldn_t_be_connected_d4fc30c"), missed: false };
    case "ongoing":
      return { title: uiText("calls.interface.value0_in_progress_08b8d36", { value0: cap(groupKind) }), detail: by, missed: false };
    case "ended":
      return { title: uiText("calls.interface.value0_ended_939c65c", { value0: cap(groupKind) }), detail: by, missed: false };
  }
}
