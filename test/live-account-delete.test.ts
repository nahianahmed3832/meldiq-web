import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AccountSessionGrant } from "../src/api/accountSchemas";
import { AccountApi } from "../src/auth/accountApi";
import { tokensOf } from "../src/auth/accountSession";
import { createIdentity } from "../src/auth/deviceSetup";
import { SetupCredentials } from "../src/auth/setupCredentials";
import { TokenVault } from "../src/auth/tokenVault";
import type { DeviceRecord } from "../src/model/types";
import { LocalStore } from "../src/store/db";
import { deleteAccount } from "../src/sync/account";
import { createWorkspace, requestId } from "../src/sync/workspaces";
import { freshStore, type Mailbox, mailbox, type Server, startBrowser, startServer, until } from "./support/live";

/** Deleting the account from the browser (server docs/ACCOUNT_DELETION.md) against the real server, test accounts only. */
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

async function browserAccount(name: string) {
  const address = email(name);
  await anon().register(name, address, PASSWORD);
  await anon().verifyEmail(address, mail.verifyCode(address), PASSWORD);
  const grant: AccountSessionGrant = await anon().login(address, PASSWORD, "Meldiq Web · Test");
  const creds = new SetupCredentials(server.baseUrl, grant);
  const { device } = await createIdentity(creds.accounts, grant.account, "Meldiq Web · Test");
  const store = await freshStore();
  await store.saveDevice(device as DeviceRecord);
  await new TokenVault(store).save(tokensOf(creds.grant));
  const browser = await startBrowser(server, device as DeviceRecord, store, creds.grant);
  await until(() => browser.engine.state.get().server, 6000, "server info");
  return { address, browser, store };
}

describe("deleting the account in the browser", () => {
  it("is advertised by the server", async () => {
    const { browser } = await browserAccount("advertised");
    expect(browser.engine.state.get().server?.features).toContain("account-delete");
    browser.engine.stop();
  });

  it("refuses a wrong password or email, and the only owner of a workspace, changing nothing", async () => {
    const { address, browser } = await browserAccount("owner");
    const engine = browser.engine;
    await expect(deleteAccount(engine, "wrong password", address)).rejects.toMatchObject({ code: "invalid_credentials" });
    await expect(deleteAccount(engine, PASSWORD, email("someone-else"))).rejects.toMatchObject({ code: "confirm_mismatch" });
    await createWorkspace(engine, "Only Owner Workspace", null, requestId());
    await expect(deleteAccount(engine, PASSWORD, address)).rejects.toMatchObject({ code: "owns_workspaces" });
    expect((await new AccountApi(engine.api).me()).account.email).toBe(address);
    engine.stop();
  });

  it("deletes the account, erases this browser's copy, and frees the address", async () => {
    const { address, browser, store } = await browserAccount("leaver");
    expect(await store.device()).not.toBeNull();
    await deleteAccount(browser.engine, PASSWORD, ` ${address.toUpperCase()} `);
    await expect(anon().login(address, PASSWORD, "web")).rejects.toMatchObject({ code: "invalid_credentials" });
    // The browser's database was deleted: opened again under its name, it's empty.
    const reopened = await LocalStore.open(store.name);
    expect(await reopened.device()).toBeNull();
    // The same address can sign up again as a new account.
    await anon().register("Leaver again", address, PASSWORD);
    await anon().verifyEmail(address, mail.verifyCode(address), PASSWORD);
    expect((await anon().login(address, PASSWORD, "web")).account.email).toBe(address);
  });
});
