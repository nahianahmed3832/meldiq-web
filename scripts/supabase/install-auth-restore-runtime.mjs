import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

// Optional private test dependency, not an installed system daemon or production Auth runtime.
if (process.platform !== "darwin" || process.arch !== "arm64") throw new Error("This pinned fixture targets macOS arm64 only");
const version = "v2.197.0";
const expected = "3fb7998e7061e2c14f3f9555b1d94d447358c965395728e0d81eac82e0e5868b";
const asset = `auth-${version}-darwin-arm64.tar.gz`;
const directory = path.join(os.homedir(), `.local/share/meldiq-supabase/auth-runtime-${version}`);
fs.mkdirSync(directory, {recursive: true, mode: 0o700});
const stat = fs.lstatSync(directory);
if (!stat.isDirectory() || stat.isSymbolicLink() || stat.mode & 0o077) throw new Error("Private runtime directory required");
const archive = path.join(directory, asset);
if (!fs.existsSync(archive)) {
  const partial = `${archive}.partial-${crypto.randomBytes(6).toString("hex")}`;
  try {
    const response = await fetch(`https://github.com/supabase/auth/releases/download/${version}/${asset}`, {signal: AbortSignal.timeout(60_000)});
    if (!response.ok) throw new Error("Official Auth artifact download failed");
    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(partial, {flags: "wx", mode: 0o600}));
    const digest = crypto.createHash("sha256");
    for await (const chunk of fs.createReadStream(partial)) digest.update(chunk);
    if (digest.digest("hex") !== expected) throw new Error("Official Auth artifact digest mismatch");
    fs.linkSync(partial, archive); // refuse overwriting another installation
  } finally {fs.rmSync(partial, {force: true});}
}
const archiveStat = fs.lstatSync(archive);
if (!archiveStat.isFile() || archiveStat.isSymbolicLink() || archiveStat.mode & 0o077) throw new Error("Private runtime archive required");
const hash = crypto.createHash("sha256");
for await (const chunk of fs.createReadStream(archive)) hash.update(chunk);
if (hash.digest("hex") !== expected) throw new Error("Pinned Auth artifact digest mismatch");
const binary = path.join(directory, "auth");
if (!fs.existsSync(binary)) {
  const result = spawnSync("tar", ["-xzf", archive, "-C", directory, "auth"], {stdio: "ignore"});
  if (result.status !== 0) throw new Error("Official Auth binary extraction failed");
}
const binaryStat = fs.lstatSync(binary);
if (!binaryStat.isFile() || binaryStat.isSymbolicLink()) throw new Error("Regular Auth binary required");
const result = spawnSync(binary, ["version"], {encoding: "utf8", env: {PATH: process.env.PATH}});
if (result.status !== 0 || result.stdout.trim() !== version) throw new Error("Auth binary version mismatch");
console.log(JSON.stringify({version, archiveSha256: expected, systemDaemonInstalled: false, ok: true}));
