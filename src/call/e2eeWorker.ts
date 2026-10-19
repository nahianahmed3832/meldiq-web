/**
 * The media-encryption worker for calls: livekit-client's own E2EE worker (pinned, 2.22.3) with two additions, both
 * between LiveKit's main thread and its frame cryptors (docs/ORBIT_WEB_CALLS.md › Badge):
 *
 * 1. Every participant's media is treated as encrypted. LiveKit decides per participant from what the media server
 *    says about their tracks; Orbit calls are always end-to-end encrypted, so a server claiming otherwise is ignored and
 *    unencrypted frames are dropped rather than played (the Android app has no plaintext fallback either).
 * 2. Each track's frames are checked on both sides of the cryptor (`frameAudit.ts`) and the counts reported to the page
 *    twice a second, so the "End-to-end encrypted" badge rests on frames that were really encrypted or decrypted.
 *
 * The worker sees only frames and the derived AES key LiveKit gives it; the call key itself stays in the page.
 */
import "livekit-client/e2ee-worker";
import { AUDIT_MESSAGE, type AuditMessage, AuditBook, decodedVerdict, encodedVerdict, type IncomingFrame, inspectIncoming, type TrackAudit } from "./frameAudit";

type EncodedFrame = { data: ArrayBuffer };
type Op = TrackAudit["op"];

interface TransformOptions {
  kind: Op;
  participantIdentity: string;
  trackId: string;
}

interface ScriptTransformer {
  readonly options: TransformOptions;
  readonly readable: ReadableStream<EncodedFrame>;
  readonly writable: WritableStream<EncodedFrame>;
}

interface WorkerScope {
  onmessage: ((ev: MessageEvent) => void) | null;
  onrtctransform?: ((ev: { transformer: ScriptTransformer }) => void) | null;
  RTCTransformEvent?: unknown;
  postMessage(message: unknown): void;
}

const scope = self as unknown as WorkerScope;
/** Often enough that received media starts within half a second of its first decrypted frame. */
const REPORT_INTERVAL_MS = 500;
const book = new AuditBook();
let serverTrailer: Uint8Array | null = null;

/** Inserts a checkpoint before and after LiveKit's cryptor for one track; returns the streams LiveKit should use. */
function audited(op: Op, participantIdentity: string, trackId: string, readable: ReadableStream<EncodedFrame>, writable: WritableStream<EncodedFrame>) {
  const audit = book.open(op, participantIdentity, trackId);
  const seen = new WeakMap<object, IncomingFrame | number>();
  const before = new TransformStream<EncodedFrame, EncodedFrame>({
    transform(frame, controller) {
      audit.frames++;
      seen.set(frame, op === "decode" ? inspectIncoming(frame.data, serverTrailer) : frame.data.byteLength);
      controller.enqueue(frame);
    },
  });
  const after = new TransformStream<EncodedFrame, EncodedFrame>({
    transform(frame, controller) {
      const noted = seen.get(frame);
      const verdict = op === "decode" ? decodedVerdict(noted as IncomingFrame | undefined, frame.data.byteLength) : encodedVerdict(noted as number | undefined, frame.data);
      book.record(audit, verdict);
      if (verdict !== "unencrypted") controller.enqueue(frame);
    },
  });
  // Ends with the track; LiveKit reports its own pipe errors.
  readable.pipeTo(before.writable).catch(() => undefined);
  after.readable.pipeTo(writable).catch(() => undefined);
  return { readable: before.readable, writable: after.writable };
}

/** Rewrites what the page sends LiveKit's worker; returns the message LiveKit should see. */
function intercept(msg: { kind?: unknown; data?: Record<string, unknown> }): unknown {
  const d = msg.data ?? {};
  switch (msg.kind) {
    case "enable":
      return { ...msg, data: { ...d, enabled: true } };
    case "decode":
    case "encode": {
      const s = audited(msg.kind, String(d.participantIdentity), String(d.trackId), d.readableStream as ReadableStream<EncodedFrame>, d.writableStream as WritableStream<EncodedFrame>);
      return { ...msg, data: { ...d, readableStream: s.readable, writableStream: s.writable } };
    }
    case "setSifTrailer":
      serverTrailer = d.trailer instanceof Uint8Array ? d.trailer : null;
      return msg;
    case "updateCodec":
      if (typeof d.previousTrackId === "string" && d.previousTrackId !== d.trackId) book.rename("decode", d.previousTrackId, String(d.trackId), String(d.participantIdentity));
      return msg;
    default:
      return msg;
  }
}

const liveKitOnMessage = scope.onmessage;
scope.onmessage = (ev: MessageEvent) => {
  const msg = ev.data as { kind?: unknown; data?: Record<string, unknown> } | null;
  liveKitOnMessage?.call(self, { data: msg && typeof msg === "object" ? intercept(msg) : msg } as MessageEvent);
};

// Firefox and Safari hand the worker each sender's and receiver's frames through RTCRtpScriptTransform.
if (scope.RTCTransformEvent && scope.onrtctransform) {
  const liveKitOnTransform = scope.onrtctransform;
  scope.onrtctransform = (event) => {
    const t = event.transformer;
    const o = t.options;
    const s = audited(o.kind, o.participantIdentity, o.trackId, t.readable, t.writable);
    liveKitOnTransform.call(self, { transformer: { options: o, readable: s.readable, writable: s.writable } });
  };
}

setInterval(() => {
  const tracks = book.drain();
  if (tracks.length) scope.postMessage({ kind: AUDIT_MESSAGE, data: { tracks } } satisfies AuditMessage);
}, REPORT_INTERVAL_MS);
