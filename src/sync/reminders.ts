import { z } from "zod";
import { ApiError, type ApiClient } from "../api/client";
import { openReminder, type ReminderKey, sealReminder } from "../crypto/reminderKeys";
import type { SavedItem } from "./navPrefs";
import {
  BRIDGE_GRACE_MS,
  browserZone,
  CATCH_UP_MS,
  laterId,
  newReminderId,
  NOTE_MAX,
  type Recurrence,
  recurrenceOf,
  type Reminder,
  type ReminderContent,
  type ReminderDto,
  repeatRule,
  stateOf,
  TITLE_MAX,
  TITLE_SAVED,
  zReminderContent,
  zReminderDto,
} from "./reminderRules";

/** What the Reminders screen shows (server feature `reminders`). [locked]: this browser can't read or seal them yet. */
export interface RemindersState {
  available: boolean;
  locked: boolean;
  items: Reminder[];
}

export const NO_REMINDERS: RemindersState = { available: false, locked: false, items: [] };

export interface ReminderHost {
  api: ApiClient;
  key(): ReminderKey | null;
  available(): boolean;
  publish(state: RemindersState): void;
  /** Shows a reminder that went off (once per occurrence): true when it was shown. */
  show(r: Reminder): Promise<boolean>;
}

const zList = z.object({ reminders: z.array(zReminderDto) });
const zOne = z.object({ reminder: zReminderDto });
const enc = encodeURIComponent;

/**
 * Reminders kept and fired by the server (server docs/REMINDERS.md; android ReminderRepository): content sealed here with
 * the account's reminder key, the server only knows when each is due. Refreshed on start, on reconnect and on every
 * `reminders.changed` / `reminder.due` frame; a reminder that went off is shown once and acknowledged.
 */
export class ReminderSync {
  private items: Reminder[] = [];
  private refreshing: Promise<void> | null = null;

  constructor(private readonly host: ReminderHost) {}

  private publish(): void {
    this.host.publish({ available: this.host.available(), locked: this.host.key() === null, items: this.items });
  }

  private async decode(d: ReminderDto): Promise<Reminder> {
    const k = this.host.key();
    let content: ReminderContent | null = null;
    if (k) {
      try {
        content = zReminderContent.parse(JSON.parse(new TextDecoder().decode(await openReminder(k, d.id, d.sealed))));
      } catch {
        content = null; // not this account's key, changed, or moved: shown as unreadable
      }
    }
    return {
      id: d.id,
      content,
      dueAt: d.dueAt,
      timeZone: d.timeZone,
      recurrence: recurrenceOf(d.repeat?.recurrence),
      state: stateOf(d.state),
      firedAt: d.firedAt ?? null,
      deliveryFailed: d.delivery === "failed",
      rev: d.rev,
      completedAt: d.completedAt ?? null,
    };
  }

  private async seal(id: string, content: ReminderContent): Promise<string> {
    const k = this.host.key();
    if (!k) throw new Error("This browser can't make reminders yet: unlock them with your recovery key first.");
    return sealReminder(k, id, new TextEncoder().encode(JSON.stringify(content)));
  }

  refresh(): Promise<void> {
    this.refreshing ??= this.load().finally(() => (this.refreshing = null));
    return this.refreshing;
  }

  private async load(): Promise<void> {
    if (!this.host.available()) {
      this.items = [];
      return this.publish();
    }
    try {
      const { reminders } = await this.host.api.json("GET", "/v1/reminders", zList);
      this.items = await Promise.all(reminders.map((d) => this.decode(d)));
    } catch {
      return; // offline: keep what's shown
    }
    this.publish();
    await this.showFired();
  }

  private async showFired(): Promise<void> {
    const now = Date.now();
    for (const r of this.items) {
      if (r.firedAt === null || now - r.firedAt > CATCH_UP_MS) continue;
      if (r.state === "done" || r.state === "dismissed") continue;
      if (await this.host.show(r).catch(() => false)) await this.host.api.call("POST", `/v1/reminders/${enc(r.id)}/ack`, { body: { firedAt: r.firedAt } }).catch(() => undefined);
    }
  }

  private put(r: Reminder): void {
    this.items = [...this.items.filter((x) => x.id !== r.id), r];
    this.publish();
  }

  async create(input: { title: string; note?: string | null; dueAt: number; recurrence: Recurrence | null; ref?: ReminderContent["ref"]; id?: string; source?: string }): Promise<Reminder> {
    const id = input.id ?? newReminderId();
    const note = input.note?.trim() ? input.note.trim().slice(0, NOTE_MAX) : null;
    const content: ReminderContent = { v: 1, title: input.title.trim().slice(0, TITLE_MAX), note, ref: input.ref ?? null, source: input.source ?? "personal" };
    const body = {
      id,
      sealed: await this.seal(id, content),
      dueAt: input.dueAt,
      timeZone: browserZone(),
      ...(input.recurrence ? { repeat: { recurrence: input.recurrence, ...repeatRule(input.dueAt) } } : {}),
    };
    const created = await this.decode((await this.host.api.json("POST", "/v1/reminders", zOne, { body })).reminder);
    this.put(created);
    return created;
  }

  /** A change based on the current revision; if another device changed it first, once more on the fresh copy. */
  private async patch(id: string, fields: Record<string, unknown>): Promise<Reminder> {
    const attempt = async (rev: number) => (await this.host.api.json("PATCH", `/v1/reminders/${enc(id)}`, zOne, { body: { rev, ...fields } })).reminder;
    const fresh = async () => (await this.host.api.json("GET", `/v1/reminders/${enc(id)}`, zOne)).reminder.rev;
    let dto: ReminderDto;
    try {
      dto = await attempt(this.items.find((x) => x.id === id)?.rev ?? (await fresh()));
    } catch (e) {
      if (!(e instanceof ApiError && (e.code === "stale_reminder" || e.status === 409))) throw e;
      dto = await attempt(await fresh());
    }
    const updated = await this.decode(dto);
    this.put(updated);
    return updated;
  }

  reschedule(id: string, dueAt: number): Promise<Reminder> {
    return this.patch(id, { dueAt });
  }

  complete(id: string): Promise<Reminder> {
    return this.patch(id, { state: "done" });
  }

  /** Stops reminding; never marks what it points at as done. */
  dismiss(id: string): Promise<Reminder> {
    return this.patch(id, { state: "dismissed" });
  }

  async edit(id: string, content: ReminderContent, dueAt: number, recurrence: Recurrence | null): Promise<Reminder> {
    return this.patch(id, { sealed: await this.seal(id, content), dueAt, timeZone: browserZone(), repeat: recurrence ? { recurrence, ...repeatRule(dueAt) } : null });
  }

  async remove(id: string): Promise<void> {
    await this.host.api.call("DELETE", `/v1/reminders/${enc(id)}`);
    this.items = this.items.filter((x) => x.id !== id);
    this.publish();
  }

  /**
   * Keeps saved messages' reminders on the server (android ReminderRepository.syncLater): one per saved item with a time,
   * moved or finished to match. Every device does it; the shared id and revisions keep them from fighting.
   */
  async syncLater(saved: readonly SavedItem[]): Promise<void> {
    if (!this.host.available() || !this.host.key()) return;
    const wanted = new Map<string, SavedItem>();
    for (const s of saved) if (s.remindAt !== null && !s.done) wanted.set(await laterId(s.messageId), s);
    const now = Date.now();
    for (const [id, item] of wanted) {
      const at = item.remindAt!;
      const existing = this.items.find((x) => x.id === id);
      if (!existing && at < now - BRIDGE_GRACE_MS) continue; // went off before: don't notify it again
      try {
        if (!existing)
          await this.create({ title: TITLE_SAVED, dueAt: at, recurrence: null, ref: { kind: "message", conversationId: item.conversationId, messageId: item.messageId }, id, source: "later" });
        else if (existing.dueAt !== at && existing.state !== "done") await this.reschedule(id, at);
      } catch {
        /* retried on the next change */
      }
    }
    for (const r of this.items) {
      if (r.content?.source !== "later" || wanted.has(r.id)) continue;
      if (r.state === "scheduled" || r.state === "fired") await this.complete(r.id).catch(() => undefined);
    }
  }
}

/** Reminder occurrences already shown on this browser ("<id>@<firedAt>"), so each goes off once here. */
const SHOWN_KEY = "reminders.shown";
const SHOWN_KEPT = 200;

/** True the first time this browser sees this occurrence of [r] go off (and remembers it). */
export async function firstShowing(store: { getValue<T>(k: string): Promise<T | undefined>; setValue(k: string, v: unknown): Promise<void> }, r: Reminder): Promise<boolean> {
  const key = `${r.id}@${r.firedAt}`;
  const shown = ((await store.getValue<string[]>(SHOWN_KEY)) ?? []).slice(-SHOWN_KEPT);
  if (shown.includes(key)) return false;
  await store.setValue(SHOWN_KEY, [...shown, key]);
  return true;
}
