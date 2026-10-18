/**
 * A stand-in "phone" for exercising Orbit Web against a LOCAL development server, built on the Orbit server's reference
 * protocol client (server/test/support/griipClient.ts in the Orbit repository, byte-compatible with the Android app). Test
 * tooling only: it never talks to production, and it is no substitute for the physical-phone test in docs/ORBIT_WEB_STATUS.md.
 *
 * Run from this repository (the Orbit server folder is found like the tests find it: ORBIT_SERVER_DIR or a clone beside it):
 *   npx tsx scripts/demo-phone.ts setup                  test accounts alice (the "phone"), bob, carol; a workspace with channels; a DM
 *   npx tsx scripts/demo-phone.ts approve ABCDE12345     alice approves a browser's link code
 *   npx tsx scripts/demo-phone.ts say bob general "hi"   someone posts to a conversation (by channel name, or "dm")
 *   npx tsx scripts/demo-phone.ts listen alice 30        print what alice's phone receives for 30 s
 *   npx tsx scripts/demo-phone.ts dm bob yourname        bob opens a DM with your real phone's account (saved as "phone")
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { serverDir } from "../test/support/serverDir";

const SERVER = serverDir();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { canonical, ed25519FromSeed, GriipClient, sign, suite } = (await import(path.join(SERVER, "test/support/griipClient.ts"))) as any;
type GriipClient = InstanceType<typeof GriipClient>;

const BASE = process.env.ORBIT_API_URL ?? "http://127.0.0.1:8080";
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) throw new Error(`demo-phone only talks to a local server, not ${BASE}`);
const STATE = path.join(SERVER, "data/demo-phone.json");

interface Saved {
  username: string;
  displayName: string;
  userId: string;
  deviceId: string;
  identitySeed: string;
  deviceSeed: string;
  encPriv: string;
  encPub: string;
}
interface State {
  people: Record<string, Saved>;
  orgId?: string;
  conversations: Record<string, string>;
}

const load = (): State => (fs.existsSync(STATE) ? (JSON.parse(fs.readFileSync(STATE, "utf8")) as State) : { people: {}, conversations: {} });
const save = (s: State) => {
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify(s, null, 2), { mode: 0o600 });
};

async function person(state: State, key: string, displayName: string): Promise<GriipClient> {
  const s = state.people[key];
  if (s) {
    const c = new GriipClient(BASE, s.username, s.displayName);
    c.identity = ed25519FromSeed(Buffer.from(s.identitySeed, "base64"));
    c.device = ed25519FromSeed(Buffer.from(s.deviceSeed, "base64"));
    c.enc = { priv: Buffer.from(s.encPriv, "base64"), pub: Buffer.from(s.encPub, "base64") };
    c.userId = s.userId;
    c.deviceId = s.deviceId;
    await c.login();
    return c;
  }
  const c = new GriipClient(BASE, `${key}${crypto.randomBytes(2).toString("hex")}`, displayName);
  await c.register();
  state.people[key] = {
    username: c.username,
    displayName,
    userId: c.userId,
    deviceId: c.deviceId,
    identitySeed: c.identity.seed.toString("base64"),
    deviceSeed: c.device.seed.toString("base64"),
    encPriv: c.enc.priv.toString("base64"),
    encPub: c.enc.pub.toString("base64"),
  };
  save(state);
  return c;
}

async function setup() {
  const state = load();
  const alice = await person(state, "alice", "Alice Rahman");
  const bob = await person(state, "bob", "Bob Chen");
  const carol = await person(state, "carol", "Carol Diaz");
  if (!state.orgId) {
    const org = (await alice.req("POST", "/v1/orgs", { name: "GriipBuddy Studio", description: "Local test workspace" })).org;
    state.orgId = org.id as string;
    for (const c of [bob, carol]) {
      const code = (await alice.req("POST", `/v1/orgs/${org.id}/invites`, { role: "MEMBER" })).invite.code;
      await c.req("POST", "/v1/invites/accept", { code });
    }
    for (const [name, topic, kind] of [
      ["general", "Company-wide chatter", "PUBLIC"],
      ["design", "Pixels, palettes and prototypes", "PUBLIC"],
      ["announcements", "Official news", "ANNOUNCEMENT"],
    ] as const) {
      const ch = (await alice.req("POST", `/v1/orgs/${org.id}/channels`, { name, topic, scope: "ORG", kind, memberIds: [bob.userId, carol.userId] })).channel;
      state.conversations[name] = ch.id;
    }
    state.conversations.dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id;
    save(state);
    await bob.send(state.conversations.general, { type: "text", text: "Morning all! The new web client is landing today 🎉" });
    await carol.send(state.conversations.general, { type: "text", text: "Nice. I'll check the layout on my laptop." });
    await bob.send(state.conversations.design, { type: "text", text: "Uploaded the Cocoa palette exploration, feedback welcome." });
    await bob.send(state.conversations.dm, { type: "text", text: "Hey Alice, can you review the release notes when you get a minute?" });
  }
  console.log(JSON.stringify({ alice: alice.username, bob: bob.username, carol: carol.username, orgId: state.orgId, conversations: state.conversations }, null, 2));
}

/** The phone's side of linking (android SessionRepository.approvePairing). */
async function approve(code: string) {
  const state = load();
  const alice = await person(state, "alice", "Alice Rahman");
  const clean = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const info = await alice.req("GET", `/v1/pairing/code/${clean}`);
  const certificate = sign(alice.identity, canonical.deviceCert(alice.identityKeyB64, info.signingKey, info.encryptionKey));
  const recipientPublicKey = await suite.kem.deserializePublicKey(Buffer.from(info.transferKey, "base64"));
  const sealed = await suite.seal({ recipientPublicKey, info: Buffer.from("griip-pairing-v1") }, alice.identity.seed, Buffer.from(info.signingKey, "base64"));
  await alice.req("POST", `/v1/pairing/code/${clean}/approve`, { certificate, sealedIdentity: Buffer.from(sealed.ct).toString("base64"), sealedEnc: Buffer.from(sealed.enc).toString("base64") });
  const fp = crypto.createHash("sha256").update(Buffer.from(info.signingKey, "base64")).digest();
  const groups = Array.from({ length: 6 }, (_, i) => String(fp.readUIntBE(i * 5, 5) % 100000).padStart(5, "0")).join(" ");
  console.log(`approved "${info.deviceName}" for ${alice.username}; device key ${groups}`);
}

async function say(who: string, where: string, text: string) {
  const state = load();
  const c = await person(state, who, who);
  const id = state.conversations[where] ?? where;
  // Like the phone's composer: @username tokens of known people become mention ids (docs/MENTIONS.md).
  const mentions = Object.values(state.people)
    .filter((p) => p.userId !== c.userId && new RegExp(`@${p.username}\\b`, "i").test(text))
    .map((p) => p.userId);
  await c.send(id, { type: "text", text, ...(mentions.length ? { mentions } : {}) });
  console.log(`${who} → ${where}: ${text}${mentions.length ? ` (mentions ${mentions.length})` : ""}`);
}

/** Opens a DM between a test person and any account by exact username (your phone's), saved under the name "phone". */
async function dm(who: string, username: string) {
  const state = load();
  const c = await person(state, who, who);
  const name = username.replace(/^@/, "");
  const found = (await c.req("GET", `/v1/users/search?q=${encodeURIComponent(name)}`)).users as { id: string; username: string }[];
  const target = found.find((u) => u.username.toLowerCase() === name.toLowerCase());
  if (!target) throw new Error(`no account @${name} on this server (check the username, and that it lets everyone find it by username)`);
  state.conversations.phone = (await c.req("POST", "/v1/conversations/dm", { userId: target.id })).conversation.id;
  save(state);
  console.log(`${who} <-> @${target.username}: conversation saved as "phone"; send with: say ${who} phone "hello"`);
}

async function listen(who: string, seconds: number) {
  const state = load();
  const c = await person(state, who, who);
  await c.connect();
  const seen = new Set<string>();
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) {
    for (const m of c.received) {
      if (seen.has(m.messageId)) continue;
      seen.add(m.messageId);
      console.log(JSON.stringify({ from: m.senderUserId === c.userId ? "self (another device)" : m.senderUserId, device: m.senderDeviceId, conversation: m.conversationId, payload: m.payload }));
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  await c.disconnect();
}

const [cmd, ...args] = process.argv.slice(2);
const run =
  cmd === "setup"
    ? setup()
    : cmd === "approve"
      ? approve(args[0] ?? "")
      : cmd === "say"
        ? say(args[0], args[1], args.slice(2).join(" "))
        : cmd === "dm"
          ? dm(args[0] ?? "bob", args[1] ?? "")
          : cmd === "listen"
            ? listen(args[0] ?? "alice", Number(args[1] ?? 30))
            : Promise.reject(new Error("usage: setup | approve <code> | say <who> <where> <text> | dm <who> <username> | listen <who> <seconds>"));
run.catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
