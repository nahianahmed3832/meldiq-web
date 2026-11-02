import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const catalog = JSON.parse(fs.readFileSync(path.join(root, "supabase/generated/source-catalog.json"), "utf8"));
const files = fs
  .readdirSync(path.join(root, "supabase/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort();
if (!files.length || new Set(files.map((f) => f.slice(0, 14))).size !== files.length) throw new Error("Missing or duplicate migration versions");
const schema = files.map(file => fs.readFileSync(path.join(root, "supabase/migrations", file), "utf8")).join("\n");
for (const table of catalog.tables) {
  if (!schema.includes(`CREATE TABLE meldiq."${table.name}"`) || !schema.includes(`ALTER TABLE meldiq."${table.name}" FORCE ROW LEVEL SECURITY;`))
    throw new Error(`Missing secured relation: ${table.name}`);
}
const native = JSON.parse(fs.readFileSync(path.join(root, "supabase/generated/native-catalog.json"), "utf8"));
const nativeSql = schema;
for (const table of native.tables) {
  if (!nativeSql.includes(`CREATE TABLE meldiq."${table.name}"`) || !nativeSql.includes(`ALTER TABLE meldiq."${table.name}" FORCE ROW LEVEL SECURITY;`))
    throw new Error(`Missing native relation ${table.name}`);
}
for (const file of files) {
  const sql = fs.readFileSync(path.join(root, "supabase/migrations", file), "utf8");
  if (/\b(?:DROP\s+(?:TABLE|SCHEMA|DATABASE)|TRUNCATE)\b/i.test(sql)) throw new Error(`Destructive SQL requires separate review: ${file}`);
  if (/ALTER TABLE realtime\.messages/i.test(sql)) throw new Error("Do not alter managed Realtime table ownership/settings");
}
console.log(
  JSON.stringify({
    tables: catalog.tables.length + native.tables.length,
    migrations: files.length,
    sha256: crypto
      .createHash("sha256")
      .update(files.map((f) => fs.readFileSync(path.join(root, "supabase/migrations", f))).join("\n"))
      .digest("hex"),
  }),
);
