import { text as uiText } from "../i18n";
import { ApiError } from "../api/client";
import type { DeviceIssue, MediaFlow } from "./types";
/**
 * Call rules shared with the Android app (android call/CallReachability.kt, CallVerification.kt › CallRecovery), kept
 * pure so they're unit-tested directly.
 */
/** The server marks unanswered 1:1 calls as missed after its ring timeout (45 s by default). */
export const RING_WINDOW_MS = 45000;
/** How long a 1:1 call waits for the other person to come back before it ends ("lost"). */
export const PEER_WINDOW_MS = 30000;
/** How long this browser keeps trying to rejoin after its own media connection was lost. */
export const REJOIN_WINDOW_MS = 45000;
/** How long to wait for a call's key before refusing to join (android CallManager.waitForKey: 40 × 250 ms). */
export const KEY_WAIT_MS = 10000;
/** How often a joiner looks for the call's key (android round 7: every 50 ms, was 250). */
export const KEY_POLL_MS = 50;
export interface RingCandidate {
  id: string;
  state: string;
  createdBy: string;
  createdAt: number;
  participants?: {
    userId: string;
  }[];
}
/** Ring recovery (android RingRecovery.shouldRing): which calls found after a reconnect should ring now. */
export function shouldRing(call: RingCandidate, me: string, now: number, handled: ReadonlySet<string>, idle: boolean): boolean {
  return (
    idle &&
    call.state === "RINGING" &&
    call.createdBy !== me &&
    !handled.has(call.id) &&
    now - call.createdAt >= 0 &&
    now - call.createdAt <= RING_WINDOW_MS &&
    !(call.participants ?? []).some((p) => p.userId === me) // already answered on another of my devices
  );
}
/** LiveKit DisconnectReason names after which rejoining can help (android CallRecovery.retryable). */
export function retryable(reason: string | undefined): boolean {
  switch (reason) {
    case undefined:
    case "UNKNOWN_REASON":
    case "SIGNAL_CLOSE":
    case "CONNECTION_TIMEOUT":
    case "MEDIA_FAILURE":
    case "STATE_MISMATCH":
    case "JOIN_FAILURE":
    case "SERVER_SHUTDOWN":
    case "MIGRATION":
      return true;
    default:
      return false; // CLIENT_INITIATED, DUPLICATE_IDENTITY, PARTICIPANT_REMOVED, ROOM_DELETED, ROOM_CLOSED, USER_REJECTED…
  }
}
/** Wait before rejoin attempt [n] (0-based): 1 s, 2 s, 4 s, then 6 s. */
export function backoff(n: number): number {
  return [1000, 2000, 4000][n] ?? 6000;
}
/**
 * Turns successive "total inbound bytes from remote tracks" samples into a [MediaFlow] (android MediaFlowMonitor). A
 * joined room or a subscribed track is not proof that media arrives; growing inbound bytes are.
 */
export class MediaFlowMonitor {
  private last: number | null = null;
  private flowed = false;
  private quiet = 0;
  state: MediaFlow = "none";
  constructor(private readonly stallSamples = 2) {}
  /** [inboundBytes] is null when there is no remote track to measure yet. */
  sample(inboundBytes: number | null): MediaFlow {
    if (inboundBytes === null) {
      this.reset();
      this.state = "waiting";
      return this.state;
    }
    const prev = this.last;
    this.last = inboundBytes;
    // A drop means the set of tracks changed: a new baseline, not a stall.
    if (prev === null || inboundBytes < prev) {
      if (!this.flowed) this.state = "waiting";
      return this.state;
    }
    if (inboundBytes > prev) {
      this.flowed = true;
      this.quiet = 0;
      this.state = "flowing";
    } else if (this.flowed) {
      this.quiet++;
      if (this.quiet >= this.stallSamples) this.state = "stalled";
    } else {
      this.state = "waiting";
    }
    return this.state;
  }
  reset(): void {
    this.last = null;
    this.flowed = false;
    this.quiet = 0;
    this.state = "none";
  }
}
type Stat = Record<string, unknown> & {
  id: string;
  type: string;
};
/**
 * The media's network path from WebRTC stats, without addresses (android MediaPath.describe): "udp · direct",
 * "tcp · direct" or "relay (tls)". Null until ICE has chosen a pair.
 */
export function describePath(stats: Iterable<Stat>): string | null {
  const all = [...stats];
  const byId = new Map(all.map((s) => [s.id, s]));
  const transport = all.find((s) => s.type === "transport");
  const pairId = typeof transport?.selectedCandidatePairId === "string" ? transport.selectedCandidatePairId : null;
  // Firefox has no transport stats and marks the pair in use as `selected`.
  const pair = (pairId ? byId.get(pairId) : undefined) ?? all.find((s) => s.type === "candidate-pair" && s.state === "succeeded" && (s.nominated === true || s.selected === true));
  if (!pair) return null;
  const local = byId.get(String(pair.localCandidateId));
  if (!local) return null;
  const protocol = typeof local.protocol === "string" ? local.protocol.toLowerCase() : "?";
  if (local.candidateType === "relay") return uiText("calls.interface.relay_value0_5909316", { value0: typeof local.relayProtocol === "string" ? local.relayProtocol.toLowerCase() : protocol });
  if (typeof local.candidateType !== "string") return null;
  return uiText("calls.interface.value0_direct_154e9c6", { value0: protocol });
}
/** User-facing messages, one per failure class (android CallFailure). */
export const CallFailure = {
  get NO_KEY() {
    return uiText("calls.interface.couldn_t_get_this_call_s_encryption_key_so_the_call_wasn_t_joined_1f360de");
  },
  get KEY_NOT_SENT() {
    return uiText("calls.interface.couldn_t_send_the_call_s_encryption_key_so_the_other_person_can_t_5fd0426");
  },
  get UNSUPPORTED() {
    return uiText("calls.interface.this_browser_can_t_encrypt_call_media_end_to_end_use_a_current_ch_e87c493");
  },
  get KEY_CHANGED() {
    return uiText("calls.interface.someone_s_security_key_in_this_conversation_changed_review_it_bef_b9786a1");
  },
  forApi(e: unknown): string {
    if (!(e instanceof ApiError)) return uiText("calls.interface.something_went_wrong_starting_the_call_try_again_b933442");
    if (e.status === 410) return uiText("calls.interface.this_call_has_already_ended_bb79723");
    if (e.status === 404) return uiText("calls.interface.this_call_no_longer_exists_bb73694");
    if (e.status === 401 || e.status === 403) return uiText("calls.interface.you_re_not_allowed_to_join_this_call_766f47e");
    if (e.code === "media_unavailable" || e.status === 503) return uiText("calls.interface.calling_isn_t_set_up_on_this_server_43c8eae");
    if (e.code === "federated_calls_unavailable") return uiText("calls.interface.calls_with_people_on_other_servers_aren_t_available_yet_af2d892");
    if (e.isNetwork) return uiText("auth.interface.couldn_t_reach_the_server_check_your_connection_and_try_again_6aefd56");
    return e.message;
  },
  /** Joining the media room failed after the server had authorised it. */
  forConnect(e: unknown): string {
    const text = e instanceof Error ? `${e.name} ${e.message}` : String(e);
    if (/timeout|timed out/i.test(text)) return uiText("calls.interface.the_call_s_media_server_didn_t_answer_in_time_the_network_may_blo_65aa775");
    if (/401|unauthori[sz]ed|permission|token/i.test(text)) return uiText("calls.interface.the_call_server_refused_this_browser_s_call_pass_try_calling_agai_a577875");
    return uiText("calls.interface.couldn_t_connect_to_the_call_s_media_server_check_your_connection_0b287a8");
  },
  device(device: "microphone" | "camera", issue: DeviceIssue): string {
    const what = device === "microphone" ? uiText("workspace.interface.microphone_17d3960") : uiText("workspace.interface.camera_251e382");
    switch (issue) {
      case "denied":
        return uiText("calls.interface.meldiq_isn_t_allowed_to_use_your_value0_allow_it_in_your_browser_d84aa37", { value0: what });
      case "missing":
        return uiText("calls.interface.no_value0_was_found_connect_one_then_try_again_e9cc97d", { value0: what });
      case "busy":
        return uiText("calls.interface.your_value0_is_in_use_by_another_app_or_tab_close_it_there_then_t_3ab0378", { value0: what });
      default:
        return uiText("calls.interface.couldn_t_start_your_value0_try_again_41e8dad", { value0: what });
    }
  },
};
/** What a getUserMedia failure means for the person (DOMException names, as browsers report them). */
export function deviceIssueOf(e: unknown): DeviceIssue {
  const name =
    e instanceof Error || (typeof e === "object" && e !== null && "name" in e)
      ? String(
          (
            e as {
              name: unknown;
            }
          ).name,
        )
      : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
    case "PermissionDeniedError":
      return "denied";
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return "missing";
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return "busy";
    default:
      return "failed";
  }
}
/**
 * Whether a camera picture is drawn mirrored (android round 7 CallMediaPolicy.mirrorPreview): only your own front-facing
 * camera, like a mirror. A back camera (`environment`) is drawn as it is, or it moves the wrong way when the phone turns;
 * laptop webcams don't say which way they face, and face you. Mirroring is local drawing only: others never see it.
 */
export function mirrorPreview(isLocal: boolean, facingMode: string | undefined): boolean {
  return isLocal && facingMode !== "environment";
}
/**
 * Deafen (batch B10, android CallManager.toggleDeafen): deafened, you hear nobody and your microphone is off; undeafened,
 * sound comes back and the microphone only comes back on if it was on before.
 */
export function deafenChange(
  deafened: boolean,
  micOn: boolean,
  micBeforeDeafen: boolean,
): {
  deafened: boolean;
  micOn: boolean;
  micBeforeDeafen: boolean;
} {
  return deafened ? { deafened: false, micOn: micBeforeDeafen, micBeforeDeafen } : { deafened: true, micOn: false, micBeforeDeafen: micOn };
}
/** Microphone processing for a call (batch B10 Noise reduction): echo cancellation always; noise and level when on. */
export const audioProcessing = (
  noiseReduction: boolean,
  opts: {
    echoCancellation?: boolean;
    autoGain?: boolean;
    microphoneId?: string | null;
  } = {},
): MediaTrackConstraints => ({
  echoCancellation: opts.echoCancellation !== false,
  noiseSuppression: noiseReduction,
  // Automatic gain follows noise reduction unless chosen on its own (Settings › Voice & Audio).
  autoGainControl: opts.autoGain ?? noiseReduction,
  // "ideal": an unplugged microphone falls back to the default instead of failing the call.
  ...(opts.microphoneId ? { deviceId: { ideal: opts.microphoneId } } : {}),
});
/**
 * A level meter's value (0–1) from an analyser's float time-domain samples (-1…1), as android MicMeter.level: the
 * square root of the RMS, so quiet speech still moves the bar.
 */
export function micLevel(samples: ArrayLike<number>): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.min(1, Math.max(0, Math.sqrt(Math.sqrt(sum / samples.length))));
}
/** A received screen share's shape, from its frame size: a phone held upright is portrait. Null before the first frame. */
export function frameShape(width: number, height: number): "portrait" | "landscape" | null {
  if (!width || !height) return null;
  return height > width ? "portrait" : "landscape";
}
/** Selected ICE transport RTT, with sender RTCP RTT as a fallback. Seconds in WebRTC become milliseconds here. */
export function roundTripMs(stats: Iterable<Stat>): number | null {
  const all = [...stats];
  const selected = all.find((s) => s.type === "transport" && typeof s.selectedCandidatePairId === "string")?.selectedCandidatePairId;
  const pair = all.find((s) => s.type === "candidate-pair" && (s.id === selected || (!selected && s.state === "succeeded" && (s.nominated === true || s.selected === true))));
  const value = pair?.currentRoundTripTime ?? all.find((s) => s.type === "remote-inbound-rtp" && typeof s.roundTripTime === "number")?.roundTripTime;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 60 ? Math.round(value * 1000) : null;
}
