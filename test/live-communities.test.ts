import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AccountSessionGrant } from "../src/api/accountSchemas";
import { AccountApi } from "../src/auth/accountApi";
import { tokensOf } from "../src/auth/accountSession";
import { createIdentity } from "../src/auth/deviceSetup";
import { SetupCredentials } from "../src/auth/setupCredentials";
import { TokenVault } from "../src/auth/tokenVault";
import type { DeviceRecord } from "../src/model/types";
import { createWorkspace, requestId } from "../src/sync/workspaces";
import { setNotificationsPaused, setStatus } from "../src/sync/status";
import { z } from "zod";
import { freshStore, type Mailbox, mailbox, type Server, startBrowser, startServer, until } from "./support/live";

const until_ = (f: () => unknown) => until(f, 6000, "condition");

/** Meldiq 2.0 against the real server (test accounts only): communities, the curated directory, signals off by default. */
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
  return browser;
}

describe("communities and the curated directory in the browser", () => {
  it("creates a community with its welcome channels, and starts with nobody in an experiment", async () => {
    const b = await browserAccount("webcommunity");
    try {
      const engine = b.engine;
      expect(engine.state.get().server?.features).toEqual(expect.arrayContaining(["communities", "experiments", "analytics-events"]));
      const org = await createWorkspace(engine, "Web Makers", null, requestId(), "community");
      expect(org.kind).toBe("community");
      await until(() => engine.state.get().orgs.find((o) => o.id === org.id)?.kind === "community", 6000, "community in the list");
      await until(
        () => ["welcome", "announcements", "general", "introductions", "lounge"].every((n) => Object.values(engine.state.get().conversations).some((c) => c.orgId === org.id && c.name === n)),
        6000,
        "community channels",
      );
      // Off by default: nobody is in an experiment and nothing is collected.
      await engine.signals.refresh();
      expect(engine.signals.enabled).toBe(false);
      expect(engine.signals.variant("home-layout", "sections")).toBe("sections");
    } finally {
      b.engine.stop();
    }
  });

  it("keeps a status with its end time and a notification pause, and counts who is online in a channel", async () => {
    const b = await browserAccount("webstatus");
    try {
      const engine = b.engine;
      expect(engine.state.get().server?.features).toEqual(expect.arrayContaining(["status-expiry", "notifications-pause", "conversation-presence"]));
      const until = Date.now() + 3_600_000;
      await setStatus(engine, "In a meeting", "📅", until);
      expect(engine.state.get().me).toMatchObject({ statusText: "In a meeting", statusEmoji: "📅", statusExpiresAt: until });
      const pause = Date.now() + 2 * 3_600_000;
      await setNotificationsPaused(engine, pause);
      expect(engine.state.get().me?.notificationsPausedUntil).toBe(pause);
      await setNotificationsPaused(engine, null);
      expect(engine.state.get().me?.notificationsPausedUntil).toBeNull();
      await setStatus(engine, null, null, null);
      expect(engine.state.get().me?.statusText).toBeNull();

      const org = await createWorkspace(engine, "Presence Makers", null, requestId(), "community");
      await until_(() => Object.values(engine.state.get().conversations).find((c) => c.orgId === org.id && c.name === "general"));
      const general = Object.values(engine.state.get().conversations).find((c) => c.orgId === org.id && c.name === "general")!;
      const presence = await engine.api.json("GET", `/v1/conversations/${general.id}/presence`, z.object({ online: z.number(), members: z.number() }));
      expect(presence.members).toBe(1);
      expect(presence.online).toBe(1); // this browser is connected and counts itself
    } finally {
      b.engine.stop();
    }
  });
});
