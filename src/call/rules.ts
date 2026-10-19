import { ApiError } from "../api/client";
import type { DeviceIssue, MediaFlow } from "./types";

/**
 * Call rules shared with the Android app (android call/CallReachability.kt, CallVerification.kt › CallRecovery), kept
 * pure so they're unit-tested directly.
 */

/** The server marks unanswered 1:1 calls as missed after its ring timeout (45 s by default). */
export const RING_WINDOW_MS = 45_000;
/** How long a 1:1 call waits for the other person to come back before it ends ("lost"). */
export const PEER_WINDOW_MS = 30_000;
/** How long this browser keeps trying to rejoin after its own media connection was lost. */
export const REJOIN_WINDOW_MS = 45_000;
/** How long to wait for a call's key before refusing to join (android CallManager.waitForKey: 40 × 250 ms). */
export const KEY_WAIT_MS = 10_000;
export const KEY_POLL_MS = 250;

export interface RingCandidate {
  id: string;
  state: string;
  createdBy: string;
  createdAt: number;
  participants?: { userId: string }[];
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
  return [1_000, 2_000, 4_000][n] ?? 6_000;
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

type Stat = Record<string, unknown> & { id: string; type: string };

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
  if (local.candidateType === "relay") return `relay (${typeof local.relayProtocol === "string" ? local.relayProtocol.toLowerCase() : protocol})`;
  if (typeof local.candidateType !== "string") return null;
  return `${protocol} · direct`;
}

/** User-facing messages, one per failure class (android CallFailure). */
export const CallFailure = {
  NO_KEY: "Couldn't get this call's encryption key, so the call wasn't joined. Ask the caller to try again.",
  UNSUPPORTED: "This browser can't encrypt call media end to end. Use a current Chrome, Edge, Firefox or Safari, or answer on your phone.",
  KEY_CHANGED: "Someone's security key in this conversation changed. Review it before calling.",

  forApi(e: unknown): string {
    if (!(e instanceof ApiError)) return "Something went wrong starting the call. Try again.";
    if (e.status === 410) return "This call has already ended.";
    if (e.status === 404) return "This call no longer exists.";
    if (e.status === 401 || e.status === 403) return "You're not allowed to join this call.";
    if (e.code === "media_unavailable" || e.status === 503) return "Calling isn't set up on this server.";
    if (e.code === "federated_calls_unavailable") return "Calls with people on other servers aren't available yet.";
    if (e.isNetwork) return "Couldn't reach the server. Check your connection and try again.";
    return e.message;
  },

  /** Joining the media room failed after the server had authorised it. */
  forConnect(e: unknown): string {
    const text = e instanceof Error ? `${e.name} ${e.message}` : String(e);
    if (/timeout|timed out/i.test(text)) return "The call's media server didn't answer in time. The network may block it; try another network.";
    if (/401|unauthori[sz]ed|permission|token/i.test(text)) return "The call server refused this browser's call pass. Try calling again.";
    return "Couldn't connect to the call's media server. Check your connection and try again.";
  },

  device(device: "microphone" | "camera", issue: DeviceIssue): string {
    const what = device === "microphone" ? "microphone" : "camera";
    switch (issue) {
      case "denied":
        return `Meldiq isn't allowed to use your ${what}. Allow it in your browser's site settings (the icon next to the address), then try again.`;
      case "missing":
        return `No ${what} was found. Connect one, then try again.`;
      case "busy":
        return `Your ${what} is in use by another app or tab. Close it there, then try again.`;
      default:
        return `Couldn't start your ${what}. Try again.`;
    }
  },
};

/** What a getUserMedia failure means for the person (DOMException names, as browsers report them). */
export function deviceIssueOf(e: unknown): DeviceIssue {
  const name = e instanceof Error || (typeof e === "object" && e !== null && "name" in e) ? String((e as { name: unknown }).name) : "";
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
