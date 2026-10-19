/**
 * Evidence that media frames were really encrypted or decrypted with the call's key (docs/ORBIT_WEB_CALLS.md › Badge).
 *
 * LiveKit's frame cryptor (livekit-client 2.22.3, `e2ee/worker/FrameCryptor.ts`) turns a frame into
 * `header ‖ AES-GCM ciphertext (payload + 16-byte tag) ‖ IV (12) ‖ [IV length, key index]` and back. It reports
 * failures, never successes, so the browser checks the frames themselves on both sides of the cryptor: a received frame
 * that comes out of the cryptor at least 30 bytes shorter than it went in, from an input ending in the trailer, was
 * authenticated by AES-GCM with a key this browser holds (frames that fail are dropped, not passed on). The same
 * pattern in reverse proves an outgoing frame was encrypted. Anything else is not counted as proof, and a frame that
 * would cross the cryptor unencrypted is dropped instead of being played or sent.
 *
 * Pure functions, shared by the worker (`e2eeWorker.ts`) and the unit tests.
 */

export const IV_LENGTH = 12;
const GCM_TAG_LENGTH = 16;
const TRAILER_LENGTH = 2;
/** What encryption adds to a frame. Codec escaping (H.264) only adds more. */
export const FRAME_OVERHEAD = GCM_TAG_LENGTH + IV_LENGTH + TRAILER_LENGTH;

/** What the worker notes about a received frame before the cryptor sees it (the cryptor rewrites `data`). */
export interface IncomingFrame {
  length: number;
  /** The second-to-last byte: LiveKit's IV length, 12 for a frame it encrypted. */
  ivLength: number;
  /** Ends with the server-injected-frame trailer the media server announced. */
  serverInjected: boolean;
}

/**
 * - `verified`: encrypted (outgoing) or authenticated and decrypted (incoming) with the call's key.
 * - `empty`: a zero-length frame (silence with DTX); nothing to encrypt, passed on.
 * - `injected`: a silence or black frame the media server injected; LiveKit checks its payload. Passed on, never proof.
 * - `unencrypted`: would cross the cryptor without encryption. Dropped.
 */
export type FrameVerdict = "verified" | "empty" | "injected" | "unencrypted";

export function inspectIncoming(data: ArrayBuffer, serverTrailer: Uint8Array | null): IncomingFrame {
  const bytes = new Uint8Array(data);
  return {
    length: bytes.byteLength,
    ivLength: bytes.byteLength >= TRAILER_LENGTH ? bytes[bytes.byteLength - 2] : -1,
    serverInjected: !!serverTrailer && serverTrailer.byteLength > 0 && endsWith(bytes, serverTrailer),
  };
}

/** A received frame after the cryptor: [before] is what [inspectIncoming] saw, [afterLength] its length now. */
export function decodedVerdict(before: IncomingFrame | undefined, afterLength: number): FrameVerdict {
  if (!before) return "unencrypted"; // not a frame this audit saw going in: can't be vouched for
  if (before.length === 0) return "empty";
  if (before.serverInjected) return "injected";
  if (before.ivLength === IV_LENGTH && afterLength <= before.length - FRAME_OVERHEAD) return "verified";
  return "unencrypted";
}

/** An outgoing frame after the cryptor: [beforeLength] what the encoder produced, [after] what goes on the wire. */
export function encodedVerdict(beforeLength: number | undefined, after: ArrayBuffer): FrameVerdict {
  if (beforeLength === undefined) return "unencrypted";
  if (beforeLength === 0) return "empty";
  const bytes = new Uint8Array(after);
  const ivLength = bytes.byteLength >= TRAILER_LENGTH ? bytes[bytes.byteLength - 2] : -1;
  if (ivLength === IV_LENGTH && bytes.byteLength >= beforeLength + FRAME_OVERHEAD) return "verified";
  return "unencrypted";
}

function endsWith(bytes: Uint8Array, tail: Uint8Array): boolean {
  if (tail.byteLength > bytes.byteLength) return false;
  const offset = bytes.byteLength - tail.byteLength;
  for (let i = 0; i < tail.byteLength; i++) if (bytes[offset + i] !== tail[i]) return false;
  return true;
}

/** Frames seen on one track since the worker's last report. */
export interface TrackAudit {
  op: "encode" | "decode";
  participantIdentity: string;
  trackId: string;
  /** Frames that reached the cryptor. */
  frames: number;
  verified: number;
  /** Dropped because they would have crossed unencrypted. */
  unencrypted: number;
  injected: number;
}

export const AUDIT_MESSAGE = "orbit.frameAudit";

export interface AuditMessage {
  kind: typeof AUDIT_MESSAGE;
  data: { tracks: TrackAudit[] };
}

export function isAuditMessage(v: unknown): v is AuditMessage {
  const m = v as AuditMessage | null;
  return !!m && m.kind === AUDIT_MESSAGE && !!m.data && Array.isArray(m.data.tracks);
}

/** Counters per track; [drain] returns what changed since the previous call and starts a new interval. */
export class AuditBook {
  private tracks = new Map<string, TrackAudit>();

  open(op: TrackAudit["op"], participantIdentity: string, trackId: string): TrackAudit {
    const a: TrackAudit = { op, participantIdentity, trackId, frames: 0, verified: 0, unencrypted: 0, injected: 0 };
    this.tracks.set(`${op}|${trackId}`, a);
    return a;
  }

  /** A reused transceiver carries a new track id; its counters follow it. */
  rename(op: TrackAudit["op"], from: string, to: string, participantIdentity: string): void {
    const a = this.tracks.get(`${op}|${from}`);
    if (!a) return;
    this.tracks.delete(`${op}|${from}`);
    a.trackId = to;
    a.participantIdentity = participantIdentity;
    this.tracks.set(`${op}|${to}`, a);
  }

  record(a: TrackAudit, v: FrameVerdict): void {
    if (v === "verified") a.verified++;
    else if (v === "unencrypted") a.unencrypted++;
    else if (v === "injected") a.injected++;
  }

  drain(): TrackAudit[] {
    const out: TrackAudit[] = [];
    for (const a of this.tracks.values()) {
      if (a.frames === 0 && a.verified === 0 && a.unencrypted === 0 && a.injected === 0) continue;
      out.push({ ...a });
      a.frames = a.verified = a.unencrypted = a.injected = 0;
    }
    return out;
  }
}
