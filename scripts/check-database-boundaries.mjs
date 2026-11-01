import fs from "node:fs";
import path from "node:path";

// Browser and admin bundles must use the API. Device IndexedDB/Room caches and secure keys remain local.
const root = path.resolve(process.argv[2] || "src");
const forbiddenImport = /(?:from\s*|import\s*\(|require\s*\()\s*["'](?:mongodb|mongoose|better-sqlite3|sqlite3|ioredis|redis)(?:["'/])/;
const publicSecret = /(?:NEXT_PUBLIC_|VITE_)(?:MONGODB|MONGO_URI|REDIS_URL|REDIS_PASSWORD|DATABASE_URL)/;
let scanned = 0;
const violations = [];
function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(file);
    else if (/\.[cm]?[jt]sx?$/.test(entry.name)) {
      scanned++;
      const source = fs.readFileSync(file, "utf8");
      if (forbiddenImport.test(source) || publicSecret.test(source) || /(?:mongodb(?:\+srv)?|rediss?):\/\//.test(source)) violations.push(path.relative(root, file));
    }
  }
}
visit(root);
console.log(JSON.stringify({ ok: violations.length === 0, scanned, violations }));
if (violations.length) process.exitCode = 1;
