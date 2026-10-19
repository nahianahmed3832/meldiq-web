import nodeCrypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { deriveReminderKey, openReminder, sealReminder } from "../src/crypto/reminderKeys";
import { defaultTime, groupReminders, laterId, type Reminder, repeatRule, snoozeUntil } from "../src/sync/reminderRules";

const r = (id: string, state: Reminder["state"], dueAt: number, extra: Partial<Reminder> = {}): Reminder => ({
  id,
  content: null,
  dueAt,
  timeZone: "UTC",
  recurrence: null,
  state,
  firedAt: null,
  deliveryFailed: false,
  rev: 1,
  completedAt: null,
  ...extra,
});

describe("reminder rules (android ReminderRulesTest)", () => {
  it("groups upcoming soonest first, overdue and done latest first", () => {
    const g = groupReminders([
      r("a", "scheduled", 30),
      r("b", "scheduled", 10),
      r("c", "fired", 5, { firedAt: 7 }),
      r("d", "fired", 6, { firedAt: 9 }),
      r("e", "done", 1, { completedAt: 2 }),
      r("f", "dismissed", 1, { completedAt: 3 }),
    ]);
    expect(g.upcoming.map((x) => x.id)).toEqual(["b", "a"]);
    expect(g.overdue.map((x) => x.id)).toEqual(["d", "c"]);
    expect(g.done.map((x) => x.id)).toEqual(["f", "e"]);
  });

  it("snoozes to 10 minutes, an hour, this evening (or tomorrow's) and tomorrow morning", () => {
    const noon = new Date(2026, 9, 20, 12, 3).getTime();
    expect(snoozeUntil("10m", noon) - noon).toBe(10 * 60_000);
    expect(snoozeUntil("1h", noon) - noon).toBe(60 * 60_000);
    expect(new Date(snoozeUntil("evening", noon)).getHours()).toBe(18);
    expect(new Date(snoozeUntil("evening", noon)).getDate()).toBe(20);
    const late = new Date(2026, 9, 20, 19, 0).getTime();
    expect(new Date(snoozeUntil("evening", late)).getDate()).toBe(21);
    const t = new Date(snoozeUntil("tomorrow", noon));
    expect([t.getDate(), t.getHours(), t.getMinutes()]).toEqual([21, 9, 0]);
  });

  it("starts new reminders on the next quarter hour at least five minutes ahead, and keeps repeating ones on local time", () => {
    const d = new Date(defaultTime(new Date(2026, 9, 20, 12, 3, 20).getTime()));
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([12, 15, 0]);
    expect(repeatRule(new Date(2026, 0, 5, 7, 30).getTime())).toEqual({ localTime: "07:30", anchorDate: "2026-01-05" });
  });

  it("names a saved message's reminder the same way as the phone", async () => {
    const expected = `later_${nodeCrypto.createHash("sha256").update("later|msg-1").digest().subarray(0, 16).toString("hex")}`;
    expect(await laterId("msg-1")).toBe(expected);
  });
});

describe("sealed reminder content (android ReminderCrypto, server docs/REMINDERS.md)", () => {
  const seed = nodeCrypto.randomBytes(32);

  /** An independent implementation of the documented format, as the phone does it. */
  function nodeOpen(userId: string, id: string, sealed: string): string {
    const key = Buffer.from(nodeCrypto.hkdfSync("sha256", seed, Buffer.from("meldiq-reminders-v1"), Buffer.from(`enc|${userId}`), 32));
    const bytes = Buffer.from(sealed, "base64url");
    expect(bytes[0]).toBe(1);
    const d = nodeCrypto.createDecipheriv("aes-256-gcm", key, bytes.subarray(1, 13));
    d.setAAD(Buffer.from(`meldiq-reminder-v1|${userId}|${id}`));
    d.setAuthTag(bytes.subarray(bytes.length - 16));
    return Buffer.concat([d.update(bytes.subarray(13, bytes.length - 16)), d.final()]).toString("utf8");
  }
  function nodeSeal(userId: string, id: string, text: string): string {
    const key = Buffer.from(nodeCrypto.hkdfSync("sha256", seed, Buffer.from("meldiq-reminders-v1"), Buffer.from(`enc|${userId}`), 32));
    const nonce = nodeCrypto.randomBytes(12);
    const c = nodeCrypto.createCipheriv("aes-256-gcm", key, nonce);
    c.setAAD(Buffer.from(`meldiq-reminder-v1|${userId}|${id}`));
    const body = Buffer.concat([c.update(text, "utf8"), c.final(), c.getAuthTag()]);
    return Buffer.concat([Buffer.from([1]), nonce, body]).toString("base64url");
  }

  it("the browser's sealing opens with the documented format, and the documented format opens in the browser", async () => {
    const k = await deriveReminderKey(new Uint8Array(seed), "u_1");
    const sealed = await sealReminder(k, "rem_1", new TextEncoder().encode('{"v":1,"title":"Call Bob"}'));
    expect(nodeOpen("u_1", "rem_1", sealed)).toBe('{"v":1,"title":"Call Bob"}');
    const fromPhone = nodeSeal("u_1", "rem_2", '{"v":1,"title":"Pay rent","source":"personal"}');
    expect(new TextDecoder().decode(await openReminder(k, "rem_2", fromPhone))).toBe('{"v":1,"title":"Pay rent","source":"personal"}');
  });

  it("refuses content moved to another reminder or another account", async () => {
    const k = await deriveReminderKey(new Uint8Array(seed), "u_1");
    const sealed = await sealReminder(k, "rem_1", new TextEncoder().encode("x"));
    await expect(openReminder(k, "rem_other", sealed)).rejects.toThrow();
    const other = await deriveReminderKey(new Uint8Array(seed), "u_2");
    await expect(openReminder(other, "rem_1", sealed)).rejects.toThrow();
  });
});
