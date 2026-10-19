import { type Call, zCallList } from "../api/schemas";
import type { ApiClient } from "../api/client";
import type { CallInfo, CallLogItem, StoredMessage } from "../model/types";
import type { LocalStore } from "../store/db";
import { summarize } from "./callHistory";
import { callEntry } from "./rules";

const CALL_LOG_KEY = "calls.log";
const CALL_LOG_SIZE = 50;

/** What the call history needs from the engine. */
export interface CallLogHost {
  api: ApiClient;
  store: LocalStore;
  me: { userId: string; deviceId: string };
  knows(conversationId: string): boolean;
  declinedHere(callId: string): boolean;
  show(m: StoredMessage): void;
  bump(m: StoredMessage): Promise<void>;
  refreshPreview(conversationId: string): Promise<void>;
  publish(log: CallLogItem[]): void;
}

/**
 * Call history lines in conversations and the recent-call log (docs/CALL_HISTORY.md; android CallHistory): one entry per
 * call, `call-<callId>`, made from the server's record, a live call event or this browser starting the call, whichever
 * comes first, and updated in place, never duplicated.
 */
export class CallLog {
  private writes: Promise<void> = Promise.resolve();

  constructor(private readonly host: CallLogHost) {}

  async load(): Promise<CallLogItem[]> {
    return (await this.host.store.getValue<CallLogItem[]>(CALL_LOG_KEY)) ?? [];
  }

  /** The conversation's calls from the server's record (catches up calls that ended while this browser was away). */
  async sync(conversationId: string): Promise<void> {
    try {
      const { calls } = await this.host.api.json("GET", `/v1/conversations/${encodeURIComponent(conversationId)}/calls?limit=50`, zCallList);
      for (const c of calls.reverse()) await this.upsert(c);
    } catch {
      /* older server or offline: the live events still record calls */
    }
  }

  async upsert(call: Call): Promise<void> {
    const { store, me } = this.host;
    // A voice room's comings and goings aren't calls in its history (docs/VOICE_ROOMS.md).
    if (!this.host.knows(call.conversationId) || call.voiceRoom) return;
    const info = summarize(call, me.userId, this.host.declinedHere(call.id));
    const id = `call-${call.id}`;
    const existing = await store.message(id);
    if (existing?.call?.info && JSON.stringify(existing.call.info) === JSON.stringify(info)) return;
    const base = existing ?? this.entry(call.id, call.conversationId, call.createdBy, call.video, call.createdAt);
    const m: StoredMessage = { ...base, call: { callId: call.id, video: call.video, info } };
    await store.putMessage(m);
    this.host.show(m);
    if (!existing) await this.host.bump(m);
    else await this.host.refreshPreview(call.conversationId);
    await this.remember(m, info);
  }

  /** The entry for a call this browser started (others' come with their `call_invite` or the server's record). */
  async recordOwn(callId: string, conversationId: string, video: boolean): Promise<void> {
    const now = Date.now();
    const m = this.entry(callId, conversationId, this.host.me.userId, video, now, this.host.me.deviceId);
    if (!(await this.host.store.insertMessageIfAbsent(m))) return;
    this.host.show(m);
    await this.host.bump(m);
  }

  private entry(callId: string, conversationId: string, by: string, video: boolean, at: number, deviceId = ""): StoredMessage {
    const item = {
      id: 0,
      kind: "envelope" as const,
      conversationId,
      messageId: `call-${callId}`,
      senderUserId: by,
      senderDeviceId: deviceId,
      createdAt: at,
      expiresAt: at,
      payload: { cls: "control" as const, serverTs: at },
    };
    return callEntry(item, by === this.host.me.userId, callId, video, at);
  }

  /** Recent calls for Activity › Missed calls (the last 50, newest first; local, like the phone's call log). One write at a time. */
  private remember(m: StoredMessage, info: CallInfo): Promise<void> {
    this.writes = this.writes.then(() => this.write(m, info)).catch(() => undefined);
    return this.writes;
  }

  private async write(m: StoredMessage, info: CallInfo): Promise<void> {
    const call = m.call!;
    const log = (await this.load()).filter((x) => x.callId !== call.callId);
    const next = [{ callId: call.callId, conversationId: m.conversationId, video: call.video, at: m.sortTs, outcome: info.outcome, startedBy: info.startedBy, group: info.group }, ...log]
      .sort((a, b) => b.at - a.at)
      .slice(0, CALL_LOG_SIZE);
    await this.host.store.setValue(CALL_LOG_KEY, next);
    this.host.publish(next);
  }
}
