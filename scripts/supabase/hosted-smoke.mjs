import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(import.meta.dirname, "../..");
const settings = Object.fromEntries(
  fs
    .readFileSync(path.join(os.homedir(), ".local/share/meldiq-supabase/staging.env"), "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("="))
    .map((line) => {
      const at = line.indexOf("=");
      return [line.slice(0, at), line.slice(at + 1)];
    }),
);
const project = "bkvlxbsnzqkhbifawcww";
if (settings.SUPABASE_EXPECTED_PROJECT_REF !== project || settings.SUPABASE_ENVIRONMENT !== "staging" || !settings.SUPABASE_SECRET_KEY?.startsWith("sb_secret_"))
  throw new Error("Configure the staging-only secret key through the hidden terminal prompt");
const url = `https://${project}.supabase.co`;
// Public publishable key observed in the new staging project's Connect dialog; no production key is used.
const publishable = "sb_publishable_DSnteWCwZ3WumfEgQYWGyg_HhOQr5_f";
const server = process.env.MELDIQ_SERVER_DIR ?? path.resolve(root, "../meldiq_supabase_migration/server");
const fromSource = process.env.MELDIQ_SERVER_TS === "1";
const moduleRoot = fromSource ? "src" : "dist", extension = fromSource ? "ts" : "js";
const { MeldiqPostgres } = await import(pathToFileURL(path.join(server, `${moduleRoot}/infrastructure/database/postgres/client.${extension}`)));
const { SupabaseAccessVerifier } = await import(pathToFileURL(path.join(server, `${moduleRoot}/infrastructure/database/postgres/auth.${extension}`)));
const { PostgresOutbox } = await import(pathToFileURL(path.join(server, `${moduleRoot}/infrastructure/database/postgres/outbox.${extension}`)));
const { PostgresMessageStore } = await import(pathToFileURL(path.join(server, `${moduleRoot}/modules/messaging/store/postgresStore.${extension}`)));
const { assertSyntheticStagingDatabase } = await import(pathToFileURL(path.join(server, `${moduleRoot}/infrastructure/database/postgres/sourceSnapshot.${extension}`)));
const endpoint = new URL(settings.SUPABASE_DATABASE_URL);
if (endpoint.hostname !== "aws-1-eu-central-1.pooler.supabase.com" || decodeURIComponent(endpoint.username) !== `postgres.${project}`) throw new Error("Unexpected staging database");
const db = new MeldiqPostgres({ url: endpoint.href, environment: "staging", maxConnections: 2, ca: fs.readFileSync(settings.SUPABASE_DB_CA_FILE, "utf8") });
const options = { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } };
const admin = createClient(url, settings.SUPABASE_SECRET_KEY, options);
const clients = [],
  users = [];
const report = { observedAt: new Date().toISOString(), projectRef: project, synthetic: true, productionChanged: false, implementationSource: fromSource ? "typescript" : "compiled", checks: {} };
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function subscribed(channel) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve("HARNESS_TIMEOUT"), 20_000);
    channel.subscribe((status, error) => {
      if (error)
        report.lastChannelError = {
          status,
          message: String(error.message ?? "channel_error")
            .replace(/eyJ[A-Za-z0-9_.-]+/g, "[REDACTED_JWT]")
            .slice(0, 300),
        };
      if (["SUBSCRIBED", "CHANNEL_ERROR", "TIMED_OUT"].includes(status)) {
        clearTimeout(timeout);
        resolve(status);
      }
    });
  });
}
try {
  await assertSyntheticStagingDatabase(db);
  const run = crypto.randomBytes(6).toString("hex");
  for (let i = 0; i < 2; i++) {
    const email = `migration-${run}-${i}@example.invalid`,
      password = crypto.randomBytes(36).toString("base64url");
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    assert(!created.error && created.data.user, "Synthetic Auth user creation failed");
    const userId = `staging${run}${i}`,
      accountId = `account${run}${i}`;
    users.push({ authUserId: created.data.user.id, userId, accountId });
    await db.transaction(async () => {
      await db.query("INSERT INTO meldiq.users(id,username,display_name,identity_key,avatar_color,created_at,updated_at) VALUES($1,$1,'Synthetic migration test',$1,1,$2,$2)", [userId, Date.now()]);
      await db.query(
        "INSERT INTO meldiq.accounts(id,email,name,password_hash,password_changed_at,user_id,created_at,updated_at) VALUES($1,$2,'Synthetic migration test','!supabase-only',$3,$4,$3,$3)",
        [accountId, email, Date.now(), userId],
      );
      await db.query("INSERT INTO meldiq_private.auth_links(auth_user_id,account_id,user_id,verified_at,method) VALUES($1,$2,$3,now(),'verified_recovery')", [created.data.user.id, accountId, userId]);
    });
    const client = createClient(url, publishable, options);
    clients.push(client);
    const login = await client.auth.signInWithPassword({ email, password });
    assert(!login.error && login.data.session, "Synthetic Auth sign-in failed");
    const verified = await new SupabaseAccessVerifier(url, db).verify(login.data.session.access_token);
    assert(verified?.userId === userId, "Hosted JWT did not resolve the exact owner");
    // Synthetic policy fixture only. The separate hosted API test must exercise the real cryptographic binding route.
    const deviceId = `device${run}${i}`;
    await db.query("INSERT INTO meldiq.devices(id,user_id,name,signing_key,encryption_key,certificate,created_at) VALUES($1,$2,'Synthetic policy fixture',$1,$1,'Synthetic certificate',$3)", [deviceId, userId, Date.now()]);
    await db.query(`INSERT INTO meldiq.auth_device_sessions(id,auth_user_id,account_id,user_id,device_id,link_method,password_changed_at,bound_at)
      SELECT $1,$2,id,user_id,$3,'existing_mapping',password_changed_at,$4 FROM meldiq.accounts WHERE id=$5`, [verified.sessionId, created.data.user.id, deviceId, Date.now(), accountId]);
    users[i].sessionId = verified.sessionId;
    await client.realtime.setAuth(login.data.session.access_token);
  }
  report.checks.passwordLoginAndJwtOwnership = true;
  const conversationId = `smokeconv${run}`;
  await db.query("INSERT INTO meldiq.conversations(id,type,created_by,created_at,updated_at) VALUES($1,'DM',$2,$3,$3)", [conversationId, users[0].userId, Date.now()]);
  for (const user of users) await db.query("INSERT INTO meldiq.conversation_members(conversation_id,user_id,role,joined_at) VALUES($1,$2,'MEMBER',$3)", [conversationId, user.userId, Date.now()]);

  const hidden = await clients[0].schema("meldiq").from("accounts").select("password_hash");
  assert(hidden.error && !hidden.data, "Private account table unexpectedly exposed");
  report.checks.privateDataApiDenied = true;
  report.policyProbe = await db.asUser(users[0].authUserId, users[0].sessionId, async () => {
    const result = await db.query("SELECT meldiq_private.active_user_id() IS NOT NULL AS active, meldiq_private.can_join_topic($1,'broadcast',false) AS allowed", [`user:${users[0].userId}`]);
    return result.rows[0];
  });
  const eventId = crypto.randomUUID();
  let resolveReceipt;
  const received = new Promise((resolve) => {
    resolveReceipt = resolve;
  });
  const own = clients[0].channel(`user:${users[0].userId}`, { config: { private: true } }).on("broadcast", { event: "message.changed" }, ({ payload }) => {
    if (payload.eventId === eventId) resolveReceipt(payload);
  });
  report.ownerJoinStatus = await subscribed(own);
  assert(report.ownerJoinStatus === "SUBSCRIBED", "Owner private channel join failed");
  const denied = clients[1].channel(`user:${users[0].userId}`, { config: { private: true } });
  const unauthorized = await subscribed(denied);
  assert(unauthorized === "CHANNEL_ERROR", "Foreign private topic was not explicitly denied");
  report.checks.foreignPrivateTopicDenied = true;
  const publicChannel = clients[0].channel(`public-probe-${run}`, { config: { private: false } }).on("broadcast", { event: "probe" }, () => {});
  report.publicJoinStatus = await subscribed(publicChannel);
  report.checks.publicChannelsDisabled = report.publicJoinStatus === "CHANNEL_ERROR";
  await clients[0].removeChannel(publicChannel);
  const lease = crypto.randomUUID();
  await db.query(
    `INSERT INTO meldiq_private.outbox(event_id,aggregate_id,destination,topic,event_type,payload,lease_id,lease_until)
    VALUES($1,$2,'realtime',$3,'message.changed',$4::jsonb,$5,now()+interval '30 seconds')`,
    [eventId, `smoke:${run}`, `user:${users[0].userId}`, JSON.stringify({ messageId: "syntheticmessage", conversationId }), lease],
  );
  const item = (await db.query("SELECT * FROM meldiq_private.outbox WHERE event_id=$1", [eventId])).rows[0];
  const start = performance.now();
  assert(await new PostgresOutbox(db).publishRealtime(item), "Transactional hosted broadcast enqueue failed");
  let timer;
  const payload = await Promise.race([
    received,
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(null), 20_000);
    }),
  ]);
  clearTimeout(timer);
  assert(payload?.eventId === eventId, "Hosted private broadcast was not received");
  report.checks.hostedPrivateBroadcast = true;
  report.realtimeReceiptMilliseconds = performance.now() - start;

  const ephemeralTopic = `ephemeral:${conversationId}`;
  await db.query("INSERT INTO meldiq_private.realtime_grants(auth_user_id,topic,expires_at,presence,ephemeral_broadcast) VALUES($1,$2,now()+interval '2 minutes',true,true)", [
    users[0].authUserId,
    ephemeralTopic,
  ]);
  let resolvePresence;
  const presenceReceipt = new Promise((resolve) => {
    resolvePresence = resolve;
  });
  const presence = clients[0].channel(ephemeralTopic, { config: { private: true, presence: { key: users[0].userId } } });
  presence.on("presence", { event: "sync" }, () => {
    if (
      Object.values(presence.presenceState())
        .flat()
        .some((item) => item.userId === users[0].userId)
    )
      resolvePresence(true);
  });
  assert((await subscribed(presence)) === "SUBSCRIBED", "Presence private join failed");
  assert((await presence.track({ userId: users[0].userId })) === "ok", "Presence track failed");
  let presenceTimer;
  const presenceSeen = await Promise.race([
    presenceReceipt,
    new Promise((resolve) => {
      presenceTimer = setTimeout(() => resolve(false), 20_000);
    }),
  ]);
  clearTimeout(presenceTimer);
  assert(presenceSeen, "Presence sync was not received");
  report.checks.hostedPrivatePresence = true;
  await clients[0].removeChannel(own);
  const store = new PostgresMessageStore(db),
    outbox = new PostgresOutbox(db),
    gapId = `gapmessage${run}`;
  await store.add({
    id: gapId,
    conversation_id: conversationId,
    sender_user_id: users[0].userId,
    sender_device_id: null,
    cls: "control",
    type: "read",
    target: null,
    audience: "self",
    payload: JSON.stringify({ type: "read", upTo: Date.now() }),
    sent_at: Date.now(),
    server_ts: Date.now(),
    mention_all: 0,
    imported_by: null,
  });
  const claimed = await outbox.claim("realtime", 100);
  const gap = claimed.find((item) => item.payload.messageId === gapId);
  assert(gap && (await outbox.publishRealtime(gap)), "Hosted offline event commit failed");
  const rejoined = clients[0].channel(`user:${users[0].userId}`, { config: { private: true } });
  assert((await subscribed(rejoined)) === "SUBSCRIBED", "Owner private reconnect failed");
  assert((await store.get(gapId))?.id === gapId, "Hosted missed broadcast could not be recovered from PostgreSQL");
  report.checks.reconnectAndDurableGapRecovery = true;
  const refresh = await clients[0].auth.refreshSession();
  assert(!refresh.error && refresh.data.session, "Hosted refresh failed");
  report.checks.sessionRefresh = true;
  const oldSession = await clients[1].auth.getSession();
  const loggedOut = await clients[1].auth.signOut({ scope: "local" });
  assert(!loggedOut.error, "Hosted logout failed");
  assert((await new SupabaseAccessVerifier(url, db).verify(oldSession.data.session.access_token)) === null, "Revoked provider session remained authorized");
  report.checks.providerLogoutRevokesApi = true;

  await db.query("INSERT INTO meldiq_private.revoked_auth_sessions(session_id,auth_user_id) VALUES($1,$2)", [users[0].sessionId, users[0].authUserId]);
  assert((await new SupabaseAccessVerifier(url, db).verify(refresh.data.session.access_token)) === null, "Revoked API session remained authorized");
  report.checks.apiSessionRevocation = true;
  assert(report.checks.publicChannelsDisabled, "Public channel access was not explicitly denied");
  report.ok = true;
} catch (error) {
  report.ok = false;
  report.failure =
    error instanceof Error && /^(Synthetic|Hosted|Private|Public|Owner|Foreign|Transactional|Revoked|Presence)/.test(error.message)
      ? error.message
      : "Hosted staging smoke test failed; inspect safe codes privately";
  process.exitCode = 1;
} finally {
  for (const client of clients) {
    await client.removeAllChannels().catch(() => undefined);
    await client.auth.signOut({ scope: "local" }).catch(() => undefined);
  }
  // Retain synthetic account records as evidence, but prevent their reuse. No legacy/customer user is touched.
  for (const user of users) await admin.auth.admin.updateUserById(user.authUserId, { ban_duration: "876000h" }).catch(() => undefined);
  await db.close();
  report.syntheticAccountsCreated = users.length;
  const historyFile = path.join(root, "docs/testing/supabase-hosted-smoke-history.json");
  const history = fs.existsSync(historyFile) ? JSON.parse(fs.readFileSync(historyFile, "utf8")) : [];
  fs.writeFileSync(historyFile, JSON.stringify([...history, report].slice(-50), null, 2) + "\n");
  fs.writeFileSync(path.join(root, "docs/testing/supabase-hosted-smoke-results.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ ok: report.ok, checks: report.checks, syntheticAccounts: users.length }));
}
