import nodeCrypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AccountSessionGrant } from "../src/api/accountSchemas";
import { AccountApi } from "../src/auth/accountApi";
import { tokensOf } from "../src/auth/accountSession";
import { enrollWithSeed } from "../src/auth/deviceSetup";
import { SetupCredentials } from "../src/auth/setupCredentials";
import { TokenVault } from "../src/auth/tokenVault";
import type { DeviceRecord } from "../src/model/types";
import type { Engine } from "../src/sync/engine";
import { PERSONAL } from "../src/sync/navPrefs";
import { laterId } from "../src/sync/reminderRules";
import { type AccountPhone, accountPhone, freshStore, type Mailbox, mailbox, type Server, startBrowser, startServer, until } from "./support/live";

/**
 * Later (android Home › Later and Reminders) against the real server: saved messages synced through the personal
 * preferences document, and reminders kept and fired by the server with content sealed by the account's reminder key,
 * which the phone (the reference client, holding the identity seed) can open too.
 */
let server: Server;
let mail: Mailbox;
let phone: AccountPhone;
let web: Engine;
const reminded: { title: string; conversationId: string | null }[] = [];

async function browserFor(p: AccountPhone, strip?: (d: DeviceRecord) => DeviceRecord): Promise<Engine> {
  const grant: AccountSessionGrant = await AccountApi.anonymous(server.baseUrl).login(p.email, p.password, "Meldiq Web · Later");
  const { device } = await enrollWithSeed(new SetupCredentials(server.baseUrl, grant).accounts, grant.account, new Uint8Array(p.identity.seed), "Meldiq Web · Later");
  const record = strip ? strip(device) : device;
  const store = await freshStore();
  await store.saveDevice(record);
  await new TokenVault(store).save(tokensOf(grant));
  return (await startBrowser(server, record, store, grant, { notifyReminder: (title: string, _b: string, conversationId: string | null) => reminded.push({ title, conversationId }) })).engine;
}

/** The phone's way of opening a sealed reminder (android ReminderCrypto) with the identity seed. */
function phoneOpen(userId: string, id: string, sealed: string): Record<string, unknown> {
  const key = Buffer.from(nodeCrypto.hkdfSync("sha256", phone.identity.seed, Buffer.from("meldiq-reminders-v1"), Buffer.from(`enc|${userId}`), 32));
  const b = Buffer.from(sealed, "base64url");
  const d = nodeCrypto.createDecipheriv("aes-256-gcm", key, b.subarray(1, 13));
  d.setAAD(Buffer.from(`meldiq-reminder-v1|${userId}|${id}`));
  d.setAuthTag(b.subarray(b.length - 16));
  return JSON.parse(Buffer.concat([d.update(b.subarray(13, b.length - 16)), d.final()]).toString("utf8")) as Record<string, unknown>;
}

beforeAll(async () => {
  mail = await mailbox();
  server = await startServer({ REMINDER_TICK_MS: "200" }, { mailer: mail });
  phone = await accountPhone(server, mail, "later");
  await phone.connect();
  web = await browserFor(phone);
});
afterAll(async () => {
  web?.stop();
  await server?.close();
});

describe("saved for later", () => {
  it("saving in the browser reaches the phone's personal document; the phone's saves show in the browser", async () => {
    const dave = await server.client("dave", "Dave");
    const dm = (await dave.req("POST", "/v1/conversations/dm", { userId: phone.userId })).conversation.id as string;
    await dave.connect();
    const id = nodeCrypto.randomUUID();
    await dave.send(dm, { type: "text", text: "read this later" }, "message", id);
    await until(async () => (await web.conversationMessages(dm)).some((m) => m.id === id), 8000, "message in the browser");

    await web.later({ op: "save", conversationId: dm, messageId: id, savedAt: Date.now(), remindAt: null });
    const doc = await until(async () => {
      const d = await phone.req("GET", `/v1/me/preferences/${PERSONAL}`);
      return (d.prefs.saved ?? []).some((s: { messageId: string }) => s.messageId === id) ? d : null;
    }, 8000);
    expect(doc.prefs.saved[0]).toMatchObject({ conversationId: dm, messageId: id, done: false, remindAt: null });

    // The phone marks it done (its own write, on the latest revision): the browser follows without a reload.
    const saved = doc.prefs.saved.map((s: { messageId: string }) => (s.messageId === id ? { ...s, done: true } : s));
    await phone.req("PUT", `/v1/me/preferences/${PERSONAL}`, { baseRev: doc.rev, prefs: { ...doc.prefs, saved } });
    await until(() => web.state.get().nav[PERSONAL]?.saved?.find((s) => s.messageId === id)?.done === true, 8000, "done in the browser");

    // Other preference changes from the browser keep the saved list (it's only ever changed on purpose).
    await web.later({ op: "unsave", messageId: id });
    await until(async () => !((await phone.req("GET", `/v1/me/preferences/${PERSONAL}`)).prefs.saved ?? []).some((s: { messageId: string }) => s.messageId === id), 8000, "removed");
  });
});

describe("reminders", () => {
  it("a reminder made in the browser is sealed so the phone can read it and the server can't; it goes off, shows once and is acknowledged", async () => {
    const dueAt = Date.now() + 1500;
    const r = await web.reminders.create({ title: "Call the bank", note: "about the card", dueAt, recurrence: null });
    const row = (await phone.req("GET", `/v1/reminders/${r.id}`)).reminder;
    expect(row.sealed).not.toContain("bank");
    expect(phoneOpen(phone.userId, r.id, row.sealed)).toMatchObject({ v: 1, title: "Call the bank", note: "about the card", source: "personal" });

    await until(() => reminded.some((x) => x.title === "Call the bank"), 10_000, "the reminder went off in the browser");
    await until(async () => (await phone.req("GET", `/v1/reminders/${r.id}`)).reminder.state === "fired", 8000, "fired on the server");
    // Shown once: another refresh doesn't show it again.
    await web.reminders.refresh();
    expect(reminded.filter((x) => x.title === "Call the bank")).toHaveLength(1);

    await web.reminders.complete(r.id);
    expect((await phone.req("GET", `/v1/reminders/${r.id}`)).reminder.state).toBe("done");
  });

  it("a reminder the phone made shows here decrypted, and a change from the browser on an old revision is retried", async () => {
    const id = `rem_${nodeCrypto.randomUUID().replace(/-/g, "")}`;
    const key = Buffer.from(nodeCrypto.hkdfSync("sha256", phone.identity.seed, Buffer.from("meldiq-reminders-v1"), Buffer.from(`enc|${phone.userId}`), 32));
    const nonce = nodeCrypto.randomBytes(12);
    const c = nodeCrypto.createCipheriv("aes-256-gcm", key, nonce);
    c.setAAD(Buffer.from(`meldiq-reminder-v1|${phone.userId}|${id}`));
    const body = Buffer.concat([c.update(JSON.stringify({ v: 1, title: "Water the plants", source: "personal" })), c.final(), c.getAuthTag()]);
    const sealed = Buffer.concat([Buffer.from([1]), nonce, body]).toString("base64url");
    await phone.req("POST", "/v1/reminders", { id, sealed, dueAt: Date.now() + 3_600_000, timeZone: "Asia/Dhaka", repeat: { recurrence: "daily", localTime: "08:00", anchorDate: "2026-10-21" } });
    await until(() => web.state.get().reminders.items.some((x) => x.id === id && x.content?.title === "Water the plants" && x.recurrence === "daily"), 8000, "the phone's reminder in the browser");

    // The phone changes it first; the browser's stale revision is answered 409 and its change applied to the fresh copy.
    const current = (await phone.req("GET", `/v1/reminders/${id}`)).reminder;
    await phone.req("PATCH", `/v1/reminders/${id}`, { rev: current.rev, dueAt: Date.now() + 7_200_000 });
    const snoozedTo = Date.now() + 600_000;
    await web.reminders.reschedule(id, snoozedTo);
    expect((await phone.req("GET", `/v1/reminders/${id}`)).reminder.dueAt).toBe(snoozedTo);
  });

  it("a saved message with a time gets the same server reminder the phone would make, finished when the item is done", async () => {
    const dave = await server.client("dave2", "Dave");
    const dm = (await dave.req("POST", "/v1/conversations/dm", { userId: phone.userId })).conversation.id as string;
    await dave.connect();
    const mid = nodeCrypto.randomUUID();
    await dave.send(dm, { type: "text", text: "remind me of this" }, "message", mid);
    await until(async () => (await web.conversationMessages(dm)).some((m) => m.id === mid), 8000, "message");
    await web.later({ op: "save", conversationId: dm, messageId: mid, savedAt: Date.now(), remindAt: Date.now() + 3_600_000 });
    const rid = await laterId(mid);
    const row = await until(async () => (await phone.req("GET", "/v1/reminders")).reminders.find((x: { id: string }) => x.id === rid), 8000, "bridged reminder");
    expect(phoneOpen(phone.userId, rid, row.sealed)).toMatchObject({ title: "Saved message", source: "later", ref: { kind: "message", conversationId: dm, messageId: mid } });
    await web.later({ op: "savedDone", messageId: mid, done: true });
    await until(async () => (await phone.req("GET", `/v1/reminders/${rid}`)).reminder.state === "done", 8000, "finished with the item");
  });

  it("a browser set up before reminders existed is locked until its recovery key unlocks them; a wrong key is refused", async () => {
    const old = await browserFor(phone, (d) => ({ ...d, reminders: null }));
    try {
      await until(() => old.state.get().reminders.available, 8000, "reminders offered");
      expect(old.state.get().reminders.locked).toBe(true);
      await expect(old.reminders.create({ title: "x", dueAt: Date.now() + 60_000, recurrence: null })).rejects.toThrow(/unlock/);
      await expect(old.unlockReminders(new Uint8Array(32).fill(9))).rejects.toThrow(/different Meldiq account/);
      await old.unlockReminders(new Uint8Array(phone.identity.seed));
      expect(old.state.get().reminders.locked).toBe(false);
      expect(old.state.get().reminders.items.some((x) => x.content?.title === "Water the plants")).toBe(true);
      expect((await old.store.device())?.reminders).toBeTruthy();
    } finally {
      old.stop();
    }
  });
});
