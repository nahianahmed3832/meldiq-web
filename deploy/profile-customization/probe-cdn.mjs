// node probe-cdn.mjs https://web.meldiq.app <approved-asset-sha256>
import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";

const [base, id] = process.argv.slice(2);
assert.match(id ?? "", /^[a-f0-9]{64}$/, "approved_asset_hash_required");
const url = new URL(`/v2/profile-collectibles/assets/${id}/poster.webp`, base);
assert.equal(url.protocol, "https:");
const observations = [];
let etag;
for (let attempt = 0; attempt < 4; attempt++) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^image\/webp/);
  assert.match(response.headers.get("cache-control") ?? "", /public/);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.subarray(0, 4).toString(), "RIFF");
  assert.equal(bytes.subarray(8, 12).toString(), "WEBP");
  etag = response.headers.get("etag");
  assert.ok(etag, "origin_etag_missing");
  observations.push({ status: response.status, cache: response.headers.get("cf-cache-status"), age: response.headers.get("age"), cloudflare: !!response.headers.get("cf-ray") });
  if (["HIT", "REVALIDATED"].includes(observations.at(-1).cache)) break;
  await setTimeout(1000);
}
const conditional = await fetch(url, { headers: { "if-none-match": etag }, signal: AbortSignal.timeout(15000) });
assert.equal(conditional.status, 304, "conditional_asset_request_failed");
const cacheHit = observations.some((item) => item.cloudflare && ["HIT", "REVALIDATED"].includes(item.cache));
console.log(JSON.stringify({ url: url.href, observations, conditionalStatus: conditional.status, cacheHit, ok: cacheHit }));
assert.ok(cacheHit, "cloudflare_cache_hit_not_verified");
