import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import type { AccountSessionGrant } from "../src/api/accountSchemas";
import { ApiClient, ApiError } from "../src/api/client";
import { AccountApi } from "../src/auth/accountApi";
import { createIdentity, enrollWithSeed, SetupError } from "../src/auth/deviceSetup";
import { verifyLegacyAccount } from "../src/auth/legacyMove";
import { SetupCredentials } from "../src/auth/setupCredentials";
import { TokenVault } from "../src/auth/tokenVault";
import { encodeRecoveryCode, decodeRecoveryCode } from "../src/crypto/recoveryCode";
import type { DeviceRecord } from "../src/model/types";
import type { LocalStore } from "../src/store/db";
import { pollLinkApproval, startLink } from "../src/sync/session";
import { tokensOf } from "../src/auth/accountSession";
import { type AccountPhone, accountPhone, approveLink, freshStore, type Mailbox, mailbox, type Phone, type Server, startBrowser, startServer, until } from "./support/live";

/**
 * Orbit 2.0 accounts in the browser (docs/ORBIT_2_ARCHITECTURE §2–§5) against the real server: sign-up with an emailed
 * code, the first device making the identity, more browsers set up with the recovery key or approved by the phone,
 * session renewal, a session ended elsewhere, and moving a pre-2.0 account. Reference clients play the phones.
 */
let server: Server;
let mail: Mailbox;
const PASSWORD = "a long enough password";
let counter = 0;
const email = (n: string) => `${n}.${Date.now().toString(36)}${++counter}@example.test`;

beforeAll(async () => {
  mail = await mailbox();
  server = await startServer({}, { mailer: mail });
});
afterAll(async () => server?.close());

const anon = () => AccountApi.anonymous(server.baseUrl);

async function signUp(name: string): Promise<{ address: string; grant: AccountSessionGrant }> {
  const address = email(name);
  await anon().register(name, address, PASSWORD);
  await anon().verifyEmail(address, mail.verifyCode(address), PASSWORD);
  return { address, grant: await anon().login(address, PASSWORD, "Orbit Web · Test") };
}

/** What App does when setup finishes: keep the device and its session, then start syncing. */
async function keepAndStart(device: DeviceRecord, grant: AccountSessionGrant, store?: LocalStore) {
  const s = store ?? (await freshStore());
  await s.saveDevice(device);
  await new TokenVault(s).save(tokensOf(grant));
  return startBrowser(server, device, s, grant);
}

describe("signing up in the browser", () => {
  it("rejects sign-in before the email is verified, then the first device makes the identity and messages work", async () => {
    const address = email("ada");
    await anon().register("Ada", address, PASSWORD);
    await expect(anon().login(address, PASSWORD, "web")).rejects.toMatchObject({ code: "email_unverified" });
    await expect(anon().verifyEmail(address, "000000", PASSWORD)).rejects.toMatchObject({ code: "invalid_code" });
    await anon().verifyEmail(address, mail.verifyCode(address), PASSWORD);

    const grant = await anon().login(address, PASSWORD, "Orbit Web · Test");
    expect(grant.account.identity).toBeNull();
    const creds = new SetupCredentials(server.baseUrl, grant);
    const { device, recoveryCode } = await createIdentity(creds.accounts, grant.account, "Orbit Web · Test");
    expect(device.account).toEqual({ id: grant.account.id, email: address });
    expect(recoveryCode).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{1,4})+$/);
    // The recovery key is the identity: it derives the public key the server now holds.
    const me = await new AccountApi(new ApiClient(server.baseUrl, { token: () => creds.grant.accessToken, reauthenticate: async () => false })).me();
    expect(me.account.identity?.identityKey).toBe(device.identityKey);

    const { engine } = await keepAndStart(device, creds.grant);
    const bob = await server.client("bob", "Bob");
    await bob.connect();
    const dm = (await bob.req("POST", "/v1/conversations/dm", { userId: device.userId })).conversation.id;
    await bob.send(dm, { type: "text", text: "hello Ada" });
    await until(async () => (await engine.conversationMessages(dm)).some((m) => m.text === "hello Ada"), 8000, "message from Bob");
    const id = await engine.sendText(dm, "hi Bob, from the web");
    await bob.waitFor(() => bob.received.find((m) => m.messageId === id));
    engine.stop();
  });
});

describe("more browsers on the same account", () => {
  let address: string;
  let recovery: string;
  let first: Awaited<ReturnType<typeof keepAndStart>>;

  beforeAll(async () => {
    const s = await signUp("grace");
    address = s.address;
    const creds = new SetupCredentials(server.baseUrl, s.grant);
    const made = await createIdentity(creds.accounts, s.grant.account, "Browser one");
    recovery = made.recoveryCode;
    first = await keepAndStart(made.device, creds.grant);
  });
  afterAll(() => first?.engine.stop());

  it("a second browser set up with the recovery key gets its own device, and both see the same conversation", async () => {
    const grant = await anon().login(address, PASSWORD, "Browser two");
    const creds = new SetupCredentials(server.baseUrl, grant);
    const seed = (await decodeRecoveryCode(recovery))!;
    const { device } = await enrollWithSeed(creds.accounts, grant.account, seed, "Browser two");
    expect(device.userId).toBe(first.engine.device.userId);
    expect(device.deviceId).not.toBe(first.engine.device.deviceId);
    const second = await keepAndStart(device, creds.grant);

    const carol = await server.client("carol", "Carol");
    await carol.connect();
    const dm = (await carol.req("POST", "/v1/conversations/dm", { userId: device.userId })).conversation.id;
    await carol.send(dm, { type: "text", text: "to both browsers" });
    for (const e of [first.engine, second.engine]) await until(async () => (await e.conversationMessages(dm)).some((m) => m.text === "to both browsers"), 8000, "message in each browser");
    // A message sent from one browser shows in the other as the account's own.
    const id = await second.engine.sendText(dm, "sent from browser two");
    await until(async () => (await first.engine.store.message(id))?.outgoing === true, 8000, "own message in browser one");
    second.engine.stop();
  });

  it("refuses a recovery key from another account before sending anything", async () => {
    const grant = await anon().login(address, PASSWORD, "Browser three");
    const other = new Uint8Array(32).fill(7);
    await expect(enrollWithSeed(new SetupCredentials(server.baseUrl, grant).accounts, grant.account, other, "Browser three")).rejects.toBeInstanceOf(SetupError);
    expect(await decodeRecoveryCode((await encodeRecoveryCode(other)).slice(0, -3))).toBeNull();
  });

  it("keeps working across access-token renewals: the stored session is refreshed, never replaced", async () => {
    const before = (await new TokenVault(first.engine.store).load())!;
    // The access token runs out (15 minutes in production): expire it on the server.
    server.ctx.db.prepare("UPDATE account_sessions SET access_expires_at = ? WHERE id = ?").run(Date.now() - 1, before.sessionId);
    const me = await first.engine.api.json("GET", "/v1/users/me", z.object({ user: z.object({ id: z.string() }) }));
    expect(me.user.id).toBe(first.engine.device.userId);
    const after = (await new TokenVault(first.engine.store).load())!;
    expect(after.sessionId).toBe(before.sessionId);
    expect(after.refreshToken).not.toBe(before.refreshToken);
    expect(after.accessToken).not.toBe(before.accessToken);
    expect(first.engine.state.get().phase).toBe("ready");
  });

  it("a session signed out from another device asks for the password again, keeps local data, and continues", async () => {
    const sessionId = (await new TokenVault(first.engine.store).load())!.sessionId;
    const other = await anon().login(address, PASSWORD, "elsewhere");
    await new AccountApi(new ApiClient(server.baseUrl, { token: () => other.accessToken, reauthenticate: async () => false })).endSession(sessionId);
    // The next request (or reconnect) finds the session gone.
    first.engine.reconnect();
    await first.engine.api.call("GET", "/v1/users/me").catch(() => undefined);
    await until(() => first.engine.state.get().phase === "reauth", 8000, "password prompt");
    await expect(first.engine.signInAgain("wrong password!")).rejects.toMatchObject({ code: "invalid_credentials" });
    await first.engine.signInAgain(PASSWORD);
    expect(first.engine.state.get().phase).toBe("ready");
    await until(() => first.engine.state.get().connection === "online", 8000, "back online");
    expect((await new TokenVault(first.engine.store).load())?.sessionId).not.toBe(sessionId);
  });
});

describe("approving a browser from the phone (Orbit 2.0)", () => {
  let phone: AccountPhone;
  beforeAll(async () => {
    phone = await accountPhone(server, mail, "linus");
  });

  it("the phone's approval sets up the browser on the same account; another account's approval is refused", async () => {
    const grant = await anon().login(phone.email, phone.password, "Orbit Web · Approved");
    const link = await startLink(server.baseUrl, "Orbit Web · Approved");
    await approveLink(phone as Phone, link.code);
    const approval = await until(async () => {
      const r = await pollLinkApproval(server.baseUrl, link);
      return r.status === "approved" ? r : null;
    });
    const { device } = await enrollWithSeed(new SetupCredentials(server.baseUrl, grant).accounts, grant.account, approval.seed, "Orbit Web · Approved", link.keys);
    approval.seed.fill(0);
    expect(device.userId).toBe(phone.userId);
    const { engine } = await keepAndStart(device, grant);
    await phone.connect();
    const dave = await server.client("dave", "Dave");
    const dm = (await phone.req("POST", "/v1/conversations/dm", { userId: dave.userId })).conversation.id;
    await phone.send(dm, { type: "text", text: "sent on the phone" });
    await until(async () => (await engine.conversationMessages(dm)).some((m) => m.text === "sent on the phone" && m.outgoing), 8000, "phone's own message");
    engine.stop();

    // An approval from a different account's phone can't set up this account's browser.
    const stranger = await accountPhone(server, mail, "stranger");
    const link2 = await startLink(server.baseUrl, "Orbit Web · Wrong");
    await approveLink(stranger as Phone, link2.code);
    const wrong = await until(async () => {
      const r = await pollLinkApproval(server.baseUrl, link2);
      return r.status === "approved" ? r : null;
    });
    const grant2 = await anon().login(phone.email, phone.password, "Orbit Web · Wrong");
    await expect(enrollWithSeed(new SetupCredentials(server.baseUrl, grant2).accounts, grant2.account, wrong.seed, "Orbit Web · Wrong", link2.keys)).rejects.toBeInstanceOf(SetupError);
  });
});

describe("moving an account from before Orbit 2.0", () => {
  it("username and recovery key move it to email sign-in, keeping its id, and set up the browser", async () => {
    const legacy = await server.client("oldtimer", "Old Timer");
    const recovery = await encodeRecoveryCode(legacy.identity.seed);
    await expect(verifyLegacyAccount(anon(), legacy.username, await encodeRecoveryCode(new Uint8Array(32).fill(3)))).rejects.toMatchObject({ code: "legacy_verification_failed" });
    const { ticket, seed } = await verifyLegacyAccount(anon(), `@${legacy.username.toUpperCase()}`, recovery.toLowerCase());
    expect(ticket.legacyUser.username).toBe(legacy.username);
    const address = email("oldtimer");
    await anon().legacyComplete(ticket.ticket, "Old Timer", address, PASSWORD);
    await anon().verifyEmail(address, mail.verifyCode(address), PASSWORD);
    const grant = await anon().login(address, PASSWORD, "Orbit Web · Moved");
    expect(grant.account.identity?.userId).toBe(legacy.userId);
    const { device } = await enrollWithSeed(new SetupCredentials(server.baseUrl, grant).accounts, grant.account, seed, "Orbit Web · Moved");
    seed.fill(0);
    expect(device.userId).toBe(legacy.userId);
    // A second move of the same account is refused.
    const again = await verifyLegacyAccount(anon(), legacy.username, recovery).catch((e) => e);
    expect(again).toBeInstanceOf(ApiError);
    expect((again as ApiError).code).toBe("already_migrated");
  });
});
