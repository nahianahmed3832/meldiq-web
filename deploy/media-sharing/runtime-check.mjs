import { MongoClient } from "mongodb";
import { createHash } from "node:crypto";
import { loadConfig, effectiveFileMaxBytes } from "/app/dist/app/config.js";
import { VERSION } from "/app/dist/app/server.js";
const config = loadConfig(process.env);
if (config.databaseMode !== "atlas" || config.mongo?.domains.size !== 16) throw new Error("All sixteen Atlas authorities must remain active");
const client = new MongoClient(config.mongo.uri, { maxPoolSize: 1, serverSelectionTimeoutMS: 10000 });
try {
  await client.connect();
  const db = client.db(config.mongo.dbName);
  const fields = ["id", "user_id", "created_at"];
  const accounts = {};
  for await (const row of db.collection("accounts").find({}, { projection: Object.fromEntries(fields.map((key) => [key, 1])) })) {
    accounts[row.id] = createHash("sha256").update(JSON.stringify(fields.map((key) => row[key] ?? null))).digest("hex");
  }
  const schema = await db.collection("orbit_meta").findOne({ _id: "schema" });
  const authorities = await db.collection("orbit_meta").find({ _id: /^authority:/ }).toArray();
  console.log(JSON.stringify({ version: VERSION, schema: schema?.version, domains: [...config.mongo.domains].sort(), fileMaxBytes: effectiveFileMaxBytes(config), accounts, accountCount: Object.keys(accounts).length, authorityCount: authorities.length }));
} finally {
  await client.close();
}
