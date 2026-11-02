// Run inside the production API container. Backups stay in the private release evidence directory.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { MongoClient } from "mongodb";
import { rowHash } from "/app/dist/modules/platformAdmin/audit.js";

const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 1, serverSelectionTimeoutMS: 10000 });
try {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "meldiq");
  const orgId = "o_zTrwR4cEWpWGn3tfLWqnxg";
  const org = await db.collection("orgs").findOne({ id: orgId });
  assert(org?.name === "Meldiq HQ" && org.visibility === "public");
  const member = await db.collection("org_members").findOne({ org_id: orgId, role: "OWNER" });
  const account = await db.collection("accounts").findOne({ user_id: member?.user_id });
  assert(account);
  const admin = await db.collection("platform_admins").findOne({ account_id: account.id, role: "super_admin", revoked_at: null });
  assert(admin, "The HQ owner must be an active platform super-admin");
  const now = Date.now();
  const grants = await db
    .collection("billing_grants")
    .find({ source: "signup_trial", ends_at: { $gt: now } })
    .toArray();
  const settings = await db.collection("community_discovery").findOne({ org_id: orgId });
  assert(settings?.discoverable === 1 && settings.removed_at === null);
  const program = await db.collection("billing_program").findOne({ id: 1 });
  if (process.env.REPAIR_APPLY !== "1") {
    const notes = await db
      .collection("billing_grant_notes")
      .find({ grant_id: { $in: grants.map((grant) => grant.id) } })
      .toArray();
    console.log(JSON.stringify({ settings, program, grants, notes, capturedAt: now }));
  } else {
    assert(grants.length <= 20, "Unexpected trial count; inspect before making changes");
    const session = client.startSession();
    let ended = 0;
    try {
      await session.withTransaction(async () => {
        ended = 0;
        let last = await db.collection("platform_audit").findOne({}, { sort: { id: -1 }, session });
        const audit = async (action, targetType, targetId, detail) => {
          const body = {
            id: (last?.id ?? 0) + 1,
            at: now,
            request_id: "discovery-checkout-20261102",
            actor_account_id: account.id,
            actor_role: "super_admin",
            action,
            target_type: targetType,
            target_id: targetId,
            outcome: "success",
            reason: "Owner-requested discovery and unsuccessful-checkout correction",
            network: "production-release",
            detail: JSON.stringify(detail),
          };
          const previous = last?.hash ?? "0".repeat(64);
          const row = { ...body, prev_hash: previous, hash: rowHash(previous, body) };
          await db.collection("platform_audit").insertOne({ _id: body.id, ...row }, { session });
          await db.collection("orbit_meta").updateOne({ _id: "seq:platform_audit" }, { $max: { value: body.id } }, { upsert: true, session });
          last = row;
        };
        if (settings.official !== 1) {
          await db.collection("community_discovery").updateOne({ org_id: orgId, official: 0 }, { $set: { official: 1, updated_by: account.id, updated_at: now } }, { session });
          await audit("discovery.update", "org", orgId, { official: true });
        }
        const terms = program ?? {
          id: 1,
          enabled: 1,
          starts_at: Date.parse(process.env.BILLING_TRIAL_STARTS_AT),
          plan_key: process.env.BILLING_TRIAL_PLAN || "plus",
          referral_days: Number(process.env.BILLING_REFERRAL_DAYS || 30),
          referral_cap_days: Number(process.env.BILLING_REFERRAL_YEARLY_CAP_DAYS || 90),
          claim_window_days: Number(process.env.BILLING_REFERRAL_CLAIM_DAYS || 7),
        };
        assert(Number.isFinite(terms.starts_at));
        if (terms.days !== 0) {
          await db.collection("billing_program").replaceOne({ id: 1 }, { ...terms, _id: terms._id ?? 1, days: 0, updated_by: account.id, updated_at: now }, { upsert: true, session });
          await audit("billing.program_update", "billing_program", "trials", { days: 0 });
        }
        for (const grant of grants) {
          const paid = await db
            .collection("billing_subscriptions")
            .findOne({ billing_account_id: grant.account_id, status: { $in: ["active", "trialing"] }, $or: [{ current_period_end: { $gt: now } }, { trial_end: { $gt: now } }] }, { session });
          if (paid) continue;
          const changed = await db
            .collection("billing_grants")
            .updateOne({ id: grant.id, source: "signup_trial", ends_at: grant.ends_at }, { $set: { starts_at: Math.min(grant.starts_at, now - 1), ends_at: now } }, { session });
          assert.equal(changed.modifiedCount, 1);
          await db
            .collection("billing_grant_notes")
            .updateOne(
              { grant_id: grant.id },
              {
                $set: { ended_at: now, ended_by: account.id, original_starts_at: grant.starts_at, original_ends_at: grant.ends_at },
                $setOnInsert: { _id: grant.id, grant_id: grant.id, granted_by: null, note: "Automatic signup trial ended; payment was not verified." },
              },
              { upsert: true, session },
            );
          await audit("billing.grant_end", "billing_grant", grant.id, { source: "signup_trial" });
          ended++;
        }
      });
    } finally {
      await session.endSession();
    }
    const activeOtherGrants = await db.collection("billing_grants").countDocuments({ source: { $ne: "signup_trial" }, ends_at: { $gt: now } });
    console.log(
      JSON.stringify({
        ok: true,
        officialHqListed: true,
        automaticTrialDays: 0,
        unverifiedSignupTrialsEnded: ended,
        otherActiveGrants: activeOtherGrants,
        auditActorDigest: createHash("sha256").update(account.id).digest("hex"),
      }),
    );
  }
} finally {
  await client.close();
}
