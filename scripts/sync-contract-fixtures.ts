/**
 * Copies the server's contract fixtures (meldiq_android: shared/contracts/fixtures, and the routes of docs/api/openapi.json)
 * into test/contract-fixtures, which test/contract-fixtures.test.ts decodes with the web's own schemas. Run after the
 * server's contract changes:
 *   npx tsx scripts/sync-contract-fixtures.ts           (writes the copy)
 *   npx tsx scripts/sync-contract-fixtures.ts --check   (fails if the copy differs)
 * The checkout is MELDIQ_CONTRACTS_DIR, the repository around ORBIT_SERVER_DIR, or ../meldiq_android.
 */
import fs from "node:fs";
import path from "node:path";
import { CONTRACT_COPY, contractsRepo, currentCopy, differences, expectedCopy } from "../test/support/contracts";

const repo = contractsRepo();
if (!repo) {
  console.error("No server checkout with shared/contracts found: set MELDIQ_CONTRACTS_DIR to the meldiq_android folder.");
  process.exit(1);
}
const want = expectedCopy(repo);
const diff = differences(want, currentCopy());

if (process.argv.includes("--check")) {
  if (diff.length) {
    console.error(`test/contract-fixtures differs from ${repo}:\n  ${diff.join("\n  ")}\nRun npx tsx scripts/sync-contract-fixtures.ts`);
    process.exit(1);
  }
  console.log(`test/contract-fixtures matches ${repo} (${want.size} files)`);
} else {
  fs.rmSync(CONTRACT_COPY, { recursive: true, force: true });
  for (const [rel, text] of want) {
    const file = path.join(CONTRACT_COPY, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  }
  console.log(`Copied ${want.size} files from ${repo}${diff.length ? ` (${diff.length} changed)` : " (no changes)"}`);
}
