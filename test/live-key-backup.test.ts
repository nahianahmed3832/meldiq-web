import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AccountSessionGrant } from "../src/api/accountSchemas";
import { AccountApi } from "../src/auth/accountApi";
import { createIdentity, enrollWithEmailCode, enrollWithSeed, SetupError } from "../src/auth/deviceSetup";
import { SetupCredentials } from "../src/auth/setupCredentials";
import { decodeRecoveryCode } from "../src/crypto/recoveryCode";
import { type Mailbox, mailbox, type Server, startServer } from "./support/live";

/**
 * Keys backed up under the password (server docs/KEY_BACKUP.md) against the real server: the first browser backs its
 * new keys up, a second one unlocks them with the password and an emailed code, and after a password reset only the
 * recovery key works (and backs up again).
 */
let server: Server;
let mail: Mailbox;
const PASSWORD = "a long enough password";
const NEW_PASSWORD = "another long password";
let counter = 0;
const email = (n: string) => `${n}.${Date.now().toString(36)}${++counter}@example.test`;

beforeAll(async () => {
  mail = await mailbox();
  server = await startServer({}, { mailer: mail });
});
afterAll(async () => server?.close());

const anon = () => AccountApi.anonymous(server.baseUrl);
const creds = (grant: AccountSessionGrant) => new SetupCredentials(server.baseUrl, grant);

/** The newest code sent to [to] for setting up a new device. */
function unlockCode(to: string): string {
  const m = [...(mail.sent ?? [])].reverse().find((x) => x.to === to && /set up Meldiq on a new device/.test(x.subject));
  const code = m?.subject.match(/^(\d{6})/)?.[1];
  if (!code) throw new Error(`no unlock code sent to ${to}`);
  return code;
}

async function firstBrowser(name: string) {
  const address = email(name);
  await anon().register(name, address, PASSWORD);
  await anon().verifyEmail(address, mail.verifyCode(address), PASSWORD);
  const grant = await anon().login(address, PASSWORD, "Meldiq Web · first");
  const c = creds(grant);
  const made = await createIdentity(c.accounts, grant.account, "Meldiq Web · first", PASSWORD);
  return { address, c, made };
}

describe("key backup in the browser", () => {
  it("backs up the first browser's keys, and a second browser unlocks them with the emailed code", async () => {
    const { address, c, made } = await firstBrowser("kb");
    expect((await c.accounts.keyBackupStatus()).exists).toBe(true);
    const grant = await anon().login(address, PASSWORD, "Meldiq Web · second");
    const second = creds(grant);
    const sent = await second.accounts.startKeyUnlock();
    expect(sent.email).toMatch(/\*/);
    await expect(enrollWithEmailCode(second.accounts, grant.account, "000000", PASSWORD, "Meldiq Web · second")).rejects.toMatchObject({ code: "invalid_code" });
    await second.accounts.startKeyUnlock();
    const code = unlockCode(address);
    const { device } = await enrollWithEmailCode(second.accounts, grant.account, code, PASSWORD, "Meldiq Web · second");
    expect(device.identityKey).toBe(made.device.identityKey);
    expect(device.deviceId).not.toBe(made.device.deviceId);
  });

  it("says when the password doesn't open the backup", async () => {
    const { address } = await firstBrowser("kbwrong");
    const grant = await anon().login(address, PASSWORD, "web");
    const c = creds(grant);
    await c.accounts.startKeyUnlock();
    await expect(enrollWithEmailCode(c.accounts, grant.account, unlockCode(address), "not the password", "web")).rejects.toBeInstanceOf(SetupError);
  });

  it("after a password reset only the recovery key works, and it backs the keys up again", async () => {
    const { address, made } = await firstBrowser("kbreset");
    await anon().forgotPassword(address);
    await anon().resetPassword(address, mail.resetCode(address), NEW_PASSWORD);
    const grant = await anon().login(address, NEW_PASSWORD, "web");
    const c = creds(grant);
    expect((await c.accounts.keyBackupStatus()).exists).toBe(false);
    await expect(c.accounts.startKeyUnlock()).rejects.toMatchObject({ code: "no_key_backup" });
    const seed = (await decodeRecoveryCode(made.recoveryCode))!;
    await enrollWithSeed(c.accounts, grant.account, seed, "web", undefined, NEW_PASSWORD);
    expect((await c.accounts.keyBackupStatus()).exists).toBe(true);
  });
});
