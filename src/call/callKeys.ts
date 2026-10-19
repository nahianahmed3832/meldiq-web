import { fromB64, randomBytes, toB64, utf8 } from "../crypto/bytes";

/**
 * Per-call media keys (docs/CALLING_AND_E2EE.md › Encryption path; android MessageRepository, CallKeyVerifier,
 * CallKeyRequests, CallVerification).
 *
 * The caller makes a random 256-bit key per call and sends it inside a griip-envelope-v1 `call_invite`. A key is
 * accepted only from the call's creator, in the call's own conversation (T5.2), and the first accepted key for a call
 * wins. Keys live in this object only: never in IndexedDB, localStorage, URLs or logs, and they're gone when the tab
 * closes or the call ends.
 */

/** Android's `randomBytes(32).b64()`: standard base64 with padding, 44 characters. */
export const KEY_BYTES = 32;
const MAX_CALLS = 64;

export interface CallKey {
  callId: string;
  conversationId: string;
  /** Who sent it: always the call's creator. */
  fromUserId: string;
  key: string;
}

/** The server's record of a call, as far as key acceptance needs it. */
export interface CallRecord {
  conversationId: string;
  createdBy: string;
  state: string;
}

export type KeyVerdict = "accepted" | "duplicate" | "unknown_call" | "wrong_conversation" | "not_creator" | "ended" | "malformed";

export function newCallKey(): string {
  return toB64(randomBytes(KEY_BYTES));
}

/** A key as Android sends it: base64 of exactly 32 bytes. Anything else is refused rather than used. */
export function isWellFormedKey(key: string): boolean {
  try {
    return fromB64(key).byteLength === KEY_BYTES;
  } catch {
    return false;
  }
}

/** T5.2: who may set a call's key. [call] is the server's record, null when the call doesn't exist for this account. */
export function judgeKey(call: CallRecord | null, conversationId: string, senderUserId: string): Exclude<KeyVerdict, "accepted" | "duplicate" | "malformed"> | null {
  if (!call) return "unknown_call";
  if (call.conversationId !== conversationId) return "wrong_conversation";
  if (call.createdBy !== senderUserId) return "not_creator";
  if (call.state === "ENDED") return "ended";
  return null;
}

export class CallKeyRing {
  private keys = new Map<string, CallKey>();

  get(callId: string): CallKey | null {
    return this.keys.get(callId) ?? null;
  }

  /** The first key for a call wins: a later `call_invite` can't swap the media key mid-call. */
  accept(entry: CallKey): KeyVerdict {
    if (!isWellFormedKey(entry.key)) return "malformed";
    if (this.keys.has(entry.callId)) return "duplicate";
    this.keys.set(entry.callId, { ...entry });
    while (this.keys.size > MAX_CALLS) this.keys.delete(this.keys.keys().next().value as string);
    return "accepted";
  }

  drop(callId: string): void {
    this.keys.delete(callId);
  }

  clear(): void {
    this.keys.clear();
  }
}

/**
 * Pacing for late-joiner key requests (T5.3, android CallKeyRequests): a request only after [graceMs] without the key,
 * then at most every [intervalMs]; the creator answers each call at most every [intervalMs]. Bounded to [maxCalls].
 */
export class KeyRequestPacer {
  private firstMiss = new Map<string, number>();
  private lastRequest = new Map<string, number>();
  private lastAnswer = new Map<string, number>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly graceMs = 1_500,
    private readonly intervalMs = 5_000,
    private readonly maxCalls = MAX_CALLS,
  ) {}

  shouldRequest(callId: string): boolean {
    const t = this.now();
    const first = this.remember(this.firstMiss, callId, this.firstMiss.get(callId) ?? t);
    if (t - first < this.graceMs) return false;
    const last = this.lastRequest.get(callId);
    if (last !== undefined && t - last < this.intervalMs) return false;
    this.remember(this.lastRequest, callId, t);
    return true;
  }

  shouldAnswer(callId: string): boolean {
    const t = this.now();
    const last = this.lastAnswer.get(callId);
    if (last !== undefined && t - last < this.intervalMs) return false;
    this.remember(this.lastAnswer, callId, t);
    return true;
  }

  private remember(m: Map<string, number>, k: string, v: number): number {
    m.delete(k);
    m.set(k, v);
    while (m.size > this.maxCalls) m.delete(m.keys().next().value as string);
    return v;
  }
}

/** 64 emoji that are easy to tell apart and to name aloud (android CallVerification.EMOJI, same order). */
// prettier-ignore
export const VERIFY_EMOJI = [
  "🐶", "🐱", "🦁", "🐴", "🦄", "🐷", "🐘", "🐰", "🐼", "🐓", "🐧", "🐢", "🐟", "🐙", "🦋", "🌷",
  "🌳", "🌵", "🍄", "🌏", "🌙", "☁️", "🔥", "🍌", "🍎", "🍓", "🌽", "🍕", "🎂", "❤️", "😀", "🤖",
  "🎩", "👓", "🔧", "🎅", "👍", "☂️", "⌛", "⏰", "🎁", "💡", "📕", "✏️", "📎", "✂️", "🔒", "🔑",
  "🔨", "☎️", "🏁", "🚂", "🚲", "✈️", "🚀", "🏆", "⚽", "🎸", "🎺", "🔔", "⚓", "🎧", "📁", "📌",
] as const;

export interface VerificationCode {
  emoji: string[];
  digits: string;
}

/**
 * The call's verification code (android CallVerification.code): HKDF-SHA256 of the key's UTF-8 text, salt
 * "orbit-call-verify-v1", info the call id, 8 bytes read as one big-endian number; four 6-bit emoji from its top 24
 * bits and six digits from bits 4–23 (mod 10⁶). Devices holding the same key for the same call show the same code; the
 * key itself is never shown.
 */
export async function verificationCode(key: string, callId: string): Promise<VerificationCode> {
  const ikm = await crypto.subtle.importKey("raw", utf8(key), "HKDF", false, ["deriveBits"]);
  const okm = new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: utf8("orbit-call-verify-v1"), info: utf8(callId) }, ikm, 64));
  let bits = 0n;
  for (const b of okm) bits = (bits << 8n) | BigInt(b);
  const emoji = [0, 1, 2, 3].map((i) => VERIFY_EMOJI[Number((bits >> BigInt(58 - 6 * i)) & 0x3fn)]);
  const n = Number((bits >> 4n) & 0xfffffn) % 1_000_000;
  const digits = `${String(Math.floor(n / 1000)).padStart(3, "0")} ${String(n % 1000).padStart(3, "0")}`;
  return { emoji, digits };
}
