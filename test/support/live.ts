/**
 * A real Orbit server started in-process from the Orbit repository's server/ (its own test harness), the web engine exactly as the browser runs
 * it, and the server's reference protocol client (server/test/support/griipClient.ts, byte-compatible with the Android app)
 * playing the phone. This proves protocol interoperability; it is not a physical-device test.
 */
import "fake-indexeddb/auto";
import path from "node:path";
import type { AccountSessionGrant } from "../../src/api/accountSchemas";
import type { SessionGrant } from "../../src/api/schemas";
import type { DeviceRecord } from "../../src/model/types";
import { LocalStore } from "../../src/store/db";
import { Engine, type EngineOptions } from "../../src/sync/engine";
import { pollLink, startLink } from "../../src/sync/session";
import { b64, nodeHistory, nodeSealSeed } from "./reference";
import { serverDir } from "./serverDir";

/** The parts of the reference client the tests use. */
export interface Phone {
  userId: string;
  deviceId: string;
  token: string;
  username: string;
  identity: { seed: Buffer; pub: Buffer };
  identityKeyB64: string;
  received: { messageId: string; conversationId: string; senderUserId: string; senderDeviceId: string; payload: any }[];
  receipts: any[];
  events: any[];
  ws: { send(data: string): void } | null;
  encrypt(
    conversationId: string,
    payload: unknown,
    cls: "message" | "control",
    recipients: { id: string; encryptionKey: string; signingKey: string; certificate: string }[],
    messageId?: string,
  ): Promise<any>;
  req(method: string, path: string, body?: unknown, raw?: Buffer): Promise<any>;
  send(conversationId: string, payload: unknown, cls?: "message" | "control", messageId?: string): Promise<{ serverTs: number }>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  waitFor<T>(pred: () => T | undefined | false, timeoutMs?: number): Promise<T>;
}

export interface Server {
  baseUrl: string;
  ctx: { hub: { disconnectDevice(id: string, reason: string): void }; db: { prepare(sql: string): { run(...a: unknown[]): unknown; get(...a: unknown[]): any } } };
  client(username: string, displayName?: string): Promise<Phone>;
  close(): Promise<void>;
}

const harnessPath = path.join(serverDir(), "test/support/harness.ts");
const clientPath = path.join(serverDir(), "test/support/griipClient.ts");
const accountsPath = path.join(serverDir(), "test/support/accounts.ts");

/** Collects the server's account emails (server/test/support/accounts.ts MemoryMailer). */
export interface Mailbox {
  verifyCode(to: string): string;
  resetCode(to: string): string;
}

/** An Orbit 2.0 account on the reference client (server/test/support/accounts.ts AccountClient): the phone of an email account. */
export interface AccountPhone extends Phone {
  email: string;
  password: string;
  accountId: string;
  sessionId: string;
  signIn(withDevice?: boolean): Promise<unknown>;
}

export async function startServer(env: Record<string, string> = {}, opts: { mailer?: Mailbox } = {}): Promise<Server> {
  const mod = (await import(/* @vite-ignore */ harnessPath)) as { startServer(env: Record<string, string>, opts: { mailer?: Mailbox }): Promise<Server> };
  return mod.startServer(env, opts);
}

export async function mailbox(): Promise<Mailbox> {
  const mod = (await import(/* @vite-ignore */ accountsPath)) as { MemoryMailer: new () => Mailbox };
  return new mod.MemoryMailer();
}

/** An email account with its encryption identity on the reference client, ready to message (AccountClient.ready). */
export async function accountPhone(server: Server, mail: Mailbox, name: string): Promise<AccountPhone> {
  const mod = (await import(/* @vite-ignore */ accountsPath)) as { AccountClient: { ready(base: string, mail: Mailbox, name: string): Promise<AccountPhone> } };
  return mod.AccountClient.ready(server.baseUrl, mail, name);
}

export async function reference(): Promise<{ sign(pair: unknown, message: string): string; canonical: { deviceCert(a: string, b: string, c: string): string } }> {
  return import(/* @vite-ignore */ clientPath);
}

/** The phone's side of linking (android ProfileScreens ApproveLinkSheet + SessionRepository.approvePairing). */
export async function approveLink(phone: Phone, code: string): Promise<{ deviceName: string; signingKey: string }> {
  const info = await phone.req("GET", `/v1/pairing/code/${code}`);
  const { sign, canonical } = await reference();
  const certificate = sign(phone.identity, canonical.deviceCert(phone.identityKeyB64, info.signingKey, info.encryptionKey));
  const sealed = await nodeSealSeed(info.transferKey, info.signingKey, phone.identity.seed);
  await phone.req("POST", `/v1/pairing/code/${code}/approve`, { certificate, ...sealed });
  return info;
}

/** Uploads history items the way the phone's HistorySync does (records are the phone's Room rows). */
export async function uploadHistory(phone: Phone, messages: Record<string, unknown>[]): Promise<void> {
  const h = nodeHistory(phone.identity.seed, phone.userId);
  const items = messages.map((m) => {
    const tag = h.tag("m", String(m.id));
    return { tag, conv: h.tag("c", String(m.conversationId)), ts: Number(m.sortTs), body: b64(h.seal(tag, JSON.stringify({ v: 1, message: m }))) };
  });
  await phone.req("PUT", "/v1/history/items", { items });
}

/** Lets a test cut the browser's network for WebSockets and duplicate deliveries on the wire. */
export class TestNetwork {
  down = false;
  duplicateQueueFrames = false;

  createSocket = (url: string): WebSocket => {
    if (this.down) throw new Error("network down");
    const ws = new WebSocket(url);
    return new Proxy(ws, {
      set: (target, prop, value) => {
        if (prop === "onmessage" && typeof value === "function") {
          target.onmessage = (ev: MessageEvent) => {
            value(ev);
            if (this.duplicateQueueFrames && typeof ev.data === "string" && ev.data.includes('"t":"queue"')) value(ev);
          };
          return true;
        }
        return Reflect.set(target, prop, value);
      },
      get: (target, prop) => {
        const v = Reflect.get(target, prop);
        return typeof v === "function" ? v.bind(target) : v;
      },
    });
  };
}

let dbCounter = 0;

/** A fresh, empty IndexedDB store: one browser profile. */
export async function freshStore(): Promise<LocalStore> {
  return LocalStore.open(`orbit-web-test-${++dbCounter}-${Date.now()}`);
}

/** Starts a browser's engine the way App does once a device record exists, and waits for it to be online. */
export async function startBrowser(server: Server, device: DeviceRecord, store: LocalStore, grant?: SessionGrant | AccountSessionGrant, extra: Partial<EngineOptions> = {}): Promise<LinkedBrowser> {
  const net = new TestNetwork();
  const engine = new Engine(device, store, { base: server.baseUrl, wsUrl: server.baseUrl.replace(/^http/, "ws") + "/v1/ws", createSocket: net.createSocket, ...extra });
  await engine.start(grant);
  await until(() => engine.state.get().connection === "online" && engine.state.get().synced);
  return { engine, net };
}

export interface LinkedBrowser {
  engine: Engine;
  net: TestNetwork;
}

/** Links a new browser to [phone]'s account through the real pairing flow and starts its engine. */
export async function linkBrowser(server: Server, phone: Phone, deviceName = "Meldiq Web · Test", extra: Partial<EngineOptions> = {}): Promise<LinkedBrowser> {
  const store = await freshStore();
  const link = await startLink(server.baseUrl, deviceName);
  await approveLink(phone, link.code);
  const r = await pollLink(server.baseUrl, link);
  if (r.status !== "linked") throw new Error(`link not completed: ${r.status}`);
  await store.saveDevice(r.device);
  const net = new TestNetwork();
  const engine = new Engine(r.device, store, { base: server.baseUrl, wsUrl: server.baseUrl.replace(/^http/, "ws") + "/v1/ws", createSocket: net.createSocket, ...extra });
  await engine.start(r.grant);
  await until(() => engine.state.get().connection === "online" && engine.state.get().synced);
  return { engine, net };
}

export async function until<T>(fn: () => T | Promise<T>, timeoutMs = 6000, what = "condition"): Promise<NonNullable<T>> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v as NonNullable<T>;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 25));
  }
}
