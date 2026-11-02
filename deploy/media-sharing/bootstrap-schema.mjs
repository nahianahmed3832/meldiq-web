import { loadConfig } from "/app/dist/app/config.js";
import { MeldiqMongo, domainTables, MONGO_SCHEMA_VERSION } from "/app/dist/infrastructure/database/mongo/client.js";
const config = loadConfig(process.env);
if (config.databaseMode !== "atlas" || config.mongo?.domains.size !== 16 || MONGO_SCHEMA_VERSION !== 8) throw new Error("Unexpected schema or database authority");
const mongo = await MeldiqMongo.connect(config.mongo, domainTables(config.mongo.domains));
try {
  const schema = await mongo.db.collection("orbit_meta").findOne({ _id: "schema" });
  if (schema?.version !== 8) throw new Error("Schema bootstrap failed");
  console.log(JSON.stringify({ schema: schema.version, domains: config.mongo.domains.size, additiveMetadataOnly: true }));
} finally {
  await mongo.close();
}
