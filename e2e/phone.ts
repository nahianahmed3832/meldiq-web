/**
 * The "phone" side of the browser tests: the server's reference protocol client (byte-compatible with the Android app),
 * talking to the throwaway test server. Loaded dynamically so the web typecheck doesn't crawl the server's sources.
 */
import crypto from "node:crypto";
import path from "node:path";
import { serverDir } from "../test/support/serverDir";

const clientPath = path.join(serverDir(), "test/support/griipClient.ts");

export interface Phone {
  userId: string;
  deviceId: string;
  username: string;
  identity: { seed: Buffer };
  identityKeyB64: string;
  received: { messageId: string; conversationId: string; senderUserId: string; senderDeviceId: string; payload: { type: string; text?: string; callId?: string; e2eeKey?: string } }[];
  /** Realtime frames as they arrived (calls: `{ t: "call", event, call }`). */
  events: any[];
  /** [raw]: a binary body (a profile photo), sent as application/octet-stream. */
  req(method: string, path: string, body?: unknown, raw?: Buffer): Promise<any>;
  send(conversationId: string, payload: unknown, cls?: "message" | "control", messageId?: string): Promise<{ serverTs: number }>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

async function lib(): Promise<any> {
  return import(/* @vite-ignore */ clientPath);
}

/** A client address of its own for each test participant (the test server trusts the forwarded address). */
export function testAddress(): string {
  const b = crypto.randomBytes(3);
  return `10.${b[0]}.${b[1]}.${b[2]}`;
}

export async function newPhone(name: string, displayName: string): Promise<Phone> {
  const { GriipClient } = await lib();
  const c = new GriipClient(process.env.ORBIT_E2E_API, `${name}${crypto.randomBytes(3).toString("hex")}`, displayName);
  c.extraHeaders = { "x-forwarded-for": testAddress() };
  // API 0.57.0: messages are stored by the server, as the apps send them now (docs/SERVER_MESSAGES.md).
  c.serverMessages = true;
  await c.register();
  return c as Phone;
}

/** What the Android app does in Settings › Devices › Approve new device. Returns the device-key fingerprint it shows. */
export async function approve(phone: Phone, code: string): Promise<string> {
  const { canonical, sign, suite } = await lib();
  const clean = code.replace(/[^A-Za-z0-9]/g, "");
  const info = await phone.req("GET", `/v1/pairing/code/${clean}`);
  const certificate = sign(phone.identity, canonical.deviceCert(phone.identityKeyB64, info.signingKey, info.encryptionKey));
  const recipientPublicKey = await suite.kem.deserializePublicKey(Buffer.from(info.transferKey, "base64"));
  const sealed = await suite.seal({ recipientPublicKey, info: Buffer.from("griip-pairing-v1") }, phone.identity.seed, Buffer.from(info.signingKey, "base64"));
  await phone.req("POST", `/v1/pairing/code/${clean}/approve`, { certificate, sealedIdentity: Buffer.from(sealed.ct).toString("base64"), sealedEnc: Buffer.from(sealed.enc).toString("base64") });
  const h = crypto.createHash("sha256").update(Buffer.from(info.signingKey, "base64")).digest();
  return Array.from({ length: 6 }, (_, i) => String(h.readUIntBE(i * 5, 5) % 100000).padStart(5, "0")).join(" ");
}
