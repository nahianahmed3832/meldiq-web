/** Build and package the checked static web release plus three optional-preference API modules. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { validateCatalogs } from "../../scripts/i18n/check.mjs";

const [directory, expectedFile, apiDirectory, readerDirectory] = process.argv.slice(2);
assert(directory && expectedFile && apiDirectory && readerDirectory, "Usage: node deploy/localization/package.mjs OUTPUT EXPECTED_JSON API_SERVER READER_SERVER");
const root = path.resolve(import.meta.dirname, "../.."),
  output = path.resolve(directory);
assert(!fs.existsSync(output), "Output directory already exists");
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
const run = (file, args, cwd = root, options = {}) => execFileSync(file, args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options });
const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const git = (cwd, ...args) => run("git", args, cwd).trim();
assert.equal(git(root, "status", "--porcelain"), "", "Commit the reviewed source before packaging");
assert.equal(git(path.resolve(apiDirectory), "status", "--porcelain"), "", "API source must match its commit");
const checks = validateCatalogs(root);
assert.equal(checks.complete, true, "All locales, ICU messages and source checks must pass");
const validation = JSON.parse(fs.readFileSync(path.join(root, "docs/i18n/validation.json"), "utf8"));
assert.equal(validation.browser.status, "passed");
assert(validation.browser.totalSelectedPassed >= 66);
assert.equal(validation.serverPatch.postgres, "passed");
assert(validation.serverPatch.isolatedPostgresPassed >= 17);
assert.equal(validation.nativeReview, "awaiting-native-review");
for (const [name, args] of [
  ["localization", ["run", "i18n:check"]],
  ["types", ["run", "typecheck"]],
  ["lint", ["run", "lint"]],
  ["format", ["run", "format:check"]],
  ["unit", ["test"]],
  ["build", ["run", "build"]],
]) {
  console.log(`Running ${name}`);
  fs.writeFileSync(path.join(output, name + ".log"), run("npm", args, root, { env: { ...process.env, NEXT_PUBLIC_MELDIQ_TEST_LINKING: "0" } }));
}
assert.equal(git(root, "status", "--porcelain"), "", "Validation changed tracked source");
const source = git(root, "rev-parse", "HEAD"),
  apiSource = git(path.resolve(apiDirectory), "rev-parse", "HEAD");
const expected = JSON.parse(fs.readFileSync(expectedFile, "utf8"));
for (const key of ["expectedImage", "expectedImageId", "expectedWeb", "baselineFiles"]) assert(expected[key], `Missing production predecessor: ${key}`);
const modules = ["shared/contracts/http/preferences.js", "modules/accounts/preferences/schema.js", "modules/accounts/preferences/routes.js"];
assert.deepEqual(Object.keys(expected.baselineFiles).sort(), [...modules].sort());
const tar = (folder, file) => run("tar", ["-C", folder, "-czf", path.join(output, file), "."], root, { env: { ...process.env, COPYFILE_DISABLE: "1" } });
const apiFiles = {},
  readerFiles = {};
for (const [variant, server, hashes] of [
  ["api-overlay", apiDirectory, apiFiles],
  ["api-reader", readerDirectory, readerFiles],
]) {
  const destination = path.join(output, variant);
  fs.mkdirSync(destination, { recursive: true });
  for (const module of modules) {
    const from = path.resolve(server, "dist", module),
      to = path.join(destination, "dist", module);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    hashes[module] = sha(to);
  }
  fs.writeFileSync(
    path.join(destination, "Dockerfile"),
    `FROM ${expected.buildBaseImage ?? expected.expectedImage}\nLABEL org.opencontainers.image.revision="${apiSource}" com.meldiq.preference-variant="${variant}"\nCOPY dist/ /app/dist/\n`,
  );
  const readableCode = (folder) => {
    fs.chmodSync(folder, 0o755);
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) readableCode(file);
      else fs.chmodSync(file, 0o644);
    }
  };
  readableCode(path.join(destination, "dist"));
  tar(destination, variant + ".tar.gz");
}
for (const module of modules.slice(0, 2)) assert.equal(apiFiles[module], readerFiles[module], "Reader must use the same locale-capable schema and contract");
const dist = path.join(root, "dist");
assert(fs.existsSync(path.join(dist, "sw.js")));
assert(!fs.existsSync(path.join(dist, "config.json")), "Server configuration must stay server-owned");
const files = {};
function walk(folder) {
  for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
    const file = path.join(folder, item.name);
    assert(!item.isSymbolicLink(), "Release cannot contain symlinks");
    if (item.isDirectory()) walk(file);
    else {
      assert(!file.endsWith(".map") && !item.name.startsWith(".DS_Store"), "Release contains a source map or macOS metadata");
      files[path.relative(dist, file)] = sha(file);
    }
  }
}
walk(dist);
tar(dist, "web.tar.gz");
const archives = Object.fromEntries(["web.tar.gz", "api-overlay.tar.gz", "api-reader.tar.gz"].map((file) => [file, sha(path.join(output, file))]));
const buildId = fs.readdirSync(path.join(dist, "_next/static")).find((name) => fs.statSync(path.join(dist, "_next/static", name)).isDirectory() && !["chunks", "css", "media"].includes(name));
assert(buildId, "Missing Next.js build ID");
const imagePrefix = expected.expectedImage.slice(0, expected.expectedImage.indexOf(":"));
const baseImage = expected.buildBaseImage ?? expected.expectedImage;
const baseTag = baseImage.slice(baseImage.indexOf(":") + 1).replace(/-locales(?:-reader)?-.+$/, "");
const manifest = {
  ...expected,
  webSource: source,
  apiSource,
  buildId,
  newWeb: `/opt/meldiq-web/releases/0.5.0-beta-locales-${source.slice(0, 7)}`,
  newImage: `${imagePrefix}:${baseTag}-locales-${apiSource.slice(0, 8)}-${source.slice(0, 7)}`,
  readerImage: `${imagePrefix}:${baseTag}-locales-reader-${apiSource.slice(0, 8)}-${source.slice(0, 7)}`,
  files,
  archives,
  apiFiles,
  readerFiles,
  validation: {
    ...validation,
    localizationComplete: true,
    locales: Object.keys(checks.coverage),
    coverage: Object.fromEntries(Object.entries(checks.coverage).map(([locale, value]) => [locale, value.percent])),
    productionBuild: "passed-with-test-linking-disabled",
  },
};
for (const name of ["publish.py", "rollback.py"]) fs.copyFileSync(path.join(root, "deploy/localization", name), path.join(output, name));
fs.copyFileSync(path.join(root, "deploy/localization/compatible-reader.patch"), path.join(output, "compatible-reader.patch"));
fs.writeFileSync(path.join(output, "RELEASE.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({ output, webSource: source, apiSource, buildId, files: Object.keys(files).length, archives }));
