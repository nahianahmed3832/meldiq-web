import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { MongoClient } from 'mongodb';
import { openDatabase } from './dist/infrastructure/database/db.js';
import { openMongo } from './dist/infrastructure/database/mongo/index.js';
import { mongoConfig, MONGO_DOMAINS } from './dist/infrastructure/database/mongo/config.js';
import { tableSpecs, indexesFor, validatorFor } from './dist/infrastructure/database/mongo/catalog.js';
import { VERSION } from './dist/app/server.js';

const prepare = process.env.MELDIQ_PROBE_PREPARE === '1';
const config = mongoConfig(process.env, 'development', (_name, fallback) => fallback);
assert.ok(config);
assert.equal(config.domains.size, 16);
if (prepare) {
  assert.match(config.uri, process.env.MELDIQ_PROBE_LOCAL === '1' ? /^mongodb:\/\/127\.0\.0\.1:\d+\// : /^mongodb:\/\/controls-scratch:27017/);
  assert.match(config.dbName, /^meldiq_restore_controls_/);
}
const client = await MongoClient.connect(config.uri, {maxPoolSize: 1});
let check='connect';
try {
  const db = client.db(config.dbName);
  const accountDigest = async () => crypto.createHash('sha256').update(JSON.stringify(await db.collection('accounts').find({}).sort({_id:1}).toArray())).digest('hex');
  const before = prepare ? await accountDigest() : null;
  const counts = new Map();
  if (prepare) for (const {name} of await db.listCollections({}, {nameOnly:true}).toArray()) {
    if (name !== 'orbit_meta') counts.set(name, await db.collection(name).countDocuments());
  }
  if (prepare) {
    check='prepare_schema';
    const sqlite = openDatabase(':memory:');
    try { const mongo = await openMongo(config, sqlite, undefined, true); await mongo.close(); }
    finally { sqlite.close(); }
    check='preserve_accounts';assert.equal(await accountDigest(), before, 'Existing accounts changed during migration');
    check='preserve_counts';
    for (const [name, count] of counts) assert.equal(await db.collection(name).countDocuments(), count, `Rows changed: ${name}`);
  }
  check='schema_metadata';const schema = await db.collection('orbit_meta').findOne({_id:'schema'});
  assert.equal(schema.version, 10);
  const specs = tableSpecs().filter(s=>config.domains.has(s.domain));
  assert.deepEqual([...schema.tables].sort(), specs.map(s=>s.name).sort());
  for (const domain of MONGO_DOMAINS) {check='authority:'+domain;assert.equal((await db.collection('orbit_meta').findOne({_id:`authority:${domain}`}))?.store, 'mongodb');}
  const names = ['billing_promotion_settings','billing_promotion_state','billing_promotion_events','billing_plan_versions','platform_notices','platform_notice_receipts','platform_appeals','platform_ownership_requests','platform_appeal_challenges','billing_promotions','billing_promotion_redemptions','collectible_orders'];
  for (const name of names) {
    check='validator:'+name;
    const spec = specs.find(s=>s.name===name); assert.ok(spec);
    const definition = await db.listCollections({name}).next(); assert.ok(definition);
    assert.deepEqual(definition.options.validator, validatorFor(spec));
    const indexes = await db.collection(name).listIndexes().toArray();
    for (const expected of indexesFor(spec)) {
      check='index:'+name+':'+expected.name;
      const actual = indexes.find(i=>i.name===expected.name); assert.ok(actual);
      assert.deepEqual(Object.entries(actual.key), Object.entries(expected.key));
      assert.equal(!!actual.unique, !!expected.unique);
      if (expected.partialFilterExpression) assert.deepEqual(actual.partialFilterExpression, expected.partialFilterExpression);
    }
  }
  if (!prepare) {
    check='campaigns_withheld';
    const setting = await db.collection('billing_promotion_settings').findOne({id:1});
    assert.notEqual(setting && JSON.parse(setting.settings).enabled, true);
  }
  console.log(JSON.stringify({ok:true, version:VERSION, schemaVersion:10, authorityMarkers:16, newCollectionsVerified:names.length, existingCollectionsPreserved:counts.size, accounts:await db.collection('accounts').countDocuments(), readOnly:!prepare}));
} catch (error) {
  console.error(JSON.stringify({ok:false, check, errorType:error.name, actual:error.code==='ERR_ASSERTION'?error.actual:undefined, expected:error.code==='ERR_ASSERTION'?error.expected:undefined})); process.exitCode=1;
} finally {await client.close();}
