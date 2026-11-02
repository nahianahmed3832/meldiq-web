"""Publish the checked web export and three messaging modules, with guarded rollback."""
import datetime, fcntl, hashlib, json, os, shutil, subprocess, sys, tarfile, time
from pathlib import Path
import yaml
os.umask(0o077)
run = Path(sys.argv[1]).resolve()
m = json.loads((run / "RELEASE.json").read_text())
locks = [open(p, "a+") for p in ["/run/lock/meldiq-production-release.lock", "/opt/meldiq-web/.deploy.lock"]]
for attempt in range(60):
    try:
        for lock in locks: fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        break
    except BlockingIOError:
        for lock in locks: fcntl.flock(lock, fcntl.LOCK_UN)
        if attempt % 5 == 0: print("Waiting for the current production release lock", flush=True)
        time.sleep(3)
else: raise RuntimeError("Production release lock remains busy")
base = Path("/opt/griip-internal-messaging")
link = Path("/opt/meldiq-web/current")
old, new = Path(m["expectedWeb"]), Path(m["newWeb"])
container = "griip-internal-messaging-api-1"
def command(args, data=None):
    return subprocess.check_output(args, cwd=base, input=data, stderr=subprocess.PIPE)
def digest(data): return hashlib.sha256(data).hexdigest()
def inspect(): return json.loads(command(["docker", "inspect", container]))[0]
def compose(*args): return command(["docker", "compose", "-p", "griip-internal-messaging", "-f", "compose.yaml", *args])
def switch(target):
    temp = link.with_name("call-fixes-next")
    assert not temp.exists() and not temp.is_symlink()
    temp.symlink_to(target); os.replace(temp, link)
def served(path):
    return command(["curl", "--connect-timeout", "5", "--max-time", "15", "-fsS", "--resolve", "web.meldiq.app:443:127.0.0.1", "https://web.meldiq.app/" + path])
def healthy():
    for i in range(60):
        cur = inspect()
        if cur["State"].get("Health", {}).get("Status") == "healthy": return cur
        if i % 5 == 0: print("Waiting for API health", flush=True)
        time.sleep(2)
    raise RuntimeError("API health deadline exceeded")
before = inspect()
assert before["Config"]["Image"] == m["expectedImage"] and before["Image"] == m["expectedImageId"]
assert before["State"]["Health"]["Status"] == "healthy"
assert link.resolve() == old and not new.exists(), "Production predecessor changed"
nginx_before = command(["nginx", "-T"])
(run / "before-inspection.private.json").write_text(json.dumps(before))
other_before = command(["docker", "ps", "--format", "{{.Names}} {{.ID}}"])
for name, sha in m["archives"].items(): assert digest((run / name).read_bytes()) == sha
assert digest(served("index.html")) == digest((old / "index.html").read_bytes())
original = (base / "compose.yaml").read_bytes()
(run / "compose.before.yaml").write_bytes(original)
assert original.decode().count(m["expectedImage"]) == 1
with tarfile.open(run / "api-overlay.tar.gz") as tar: tar.extractall(run / "api-overlay", filter="data")
for path, sha in m["apiFiles"].items(): assert digest((run / "api-overlay/dist" / path).read_bytes()) == sha
# No dependency, migration, configuration or account-data changes are part of this overlay.
assert len(list((run / "api-overlay/dist").rglob("*.js"))) == 3
print("Building the three-module API overlay", flush=True)
build = subprocess.run(["docker", "build", "--pull=false", "--network=none", "--memory=256m", "--memory-swap=256m", "--cpu-quota=50000", "--cpu-period=100000", "-t", m["newImage"], str(run / "api-overlay")], env={**os.environ, "DOCKER_BUILDKIT":"0"}, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
(run / "image-build.log").write_bytes(build.stdout); assert build.returncode == 0
smoke = b"import assert from 'node:assert/strict';import {SqliteMessageStore} from '/app/dist/modules/messaging/store/messageStore.js';import {MongoMessageStore} from '/app/dist/modules/messaging/store/mongoStore.js';assert.equal(typeof SqliteMessageStore.prototype.readReceipts,'function');assert.equal(typeof MongoMessageStore.prototype.readReceipts,'function');console.log('read marker modules verified');"
command(["docker", "run", "--rm", "-i", "--network=none", "--memory=128m", "--entrypoint", "node", m["newImage"], "--input-type=module"], smoke)
# Extract the web files before switching; keep the runtime configuration and older hashed assets.
new.mkdir()
with tarfile.open(run / "web.tar.gz") as tar: tar.extractall(new, filter="data")
for path, sha in m["files"].items(): assert digest((new / path).read_bytes()) == sha
shutil.copy2(old / "config.json", new / "config.json")
shutil.copytree(old / "_next/static", new / "_next/static", dirs_exist_ok=True, copy_function=lambda a,b: b if Path(b).exists() else shutil.copy2(a,b))
assert not list(new.rglob("*.map"))
command(["chmod", "-R", "a+rX", str(new)])
changed = original.decode().replace(m["expectedImage"], m["newImage"])
expected = yaml.safe_load(original); expected["services"]["api"]["image"] = m["newImage"]
assert yaml.safe_load(changed) == expected
api_switched = False; web_switched = False
try:
    temp = base / "compose.call-fixes.tmp"; temp.write_text(changed); os.replace(temp, base / "compose.yaml")
    api_switched = True
    print("Starting the patched API", flush=True)
    compose("up", "-d", "--no-deps", "--no-build", "api")
    after = healthy()
    assert after["Config"]["Image"] == m["newImage"]
    assert dict(v.split("=", 1) for v in after["Config"]["Env"]) == dict(v.split("=", 1) for v in before["Config"]["Env"])
    assert {v["Destination"]:v for v in after["Mounts"]} == {v["Destination"]:v for v in before["Mounts"]}
    switch(new); web_switched = True
    for path in ["index.html", "sw.js", *[p for p in m["files"] if p.endswith((".css", ".js"))]]:
        assert digest(served(path)) == m["files"][path], path
    assert served("config.json") == (old / "config.json").read_bytes()
    assert nginx_before == command(["nginx", "-T"])
    def others(data): return sorted(row for row in data.decode().splitlines() if not row.startswith(container + " "))
    current_others = set(others(command(["docker", "ps", "--format", "{{.Names}} {{.ID}}"])))
    assert set(others(other_before)).issubset(current_others), "Unrelated containers changed"
except BaseException:
    if web_switched: switch(old)
    if api_switched:
        temp = base / "compose.call-fixes.rollback"; temp.write_bytes(original); os.replace(temp, base / "compose.yaml")
        compose("up", "-d", "--no-deps", "--no-build", "api"); healthy()
    raise
receipt = {"status":"deployed-and-verified", "deployedAt":datetime.datetime.now(datetime.UTC).isoformat(), "buildId":m["buildId"], "webSource":m["webSource"], "apiSource":m["apiSource"], "previousWeb":str(old), "newWeb":str(new), "previousApiImage":m["expectedImage"], "newApiImage":m["newImage"], "apiModulesReplaced":list(m["apiFiles"]), "runtimeConfigurationPreserved":True, "databaseMigrationsChanged":False, "nginxUnchanged":True, "otherContainersUnchanged":True, "publicSourceMaps":False, "validation":m["validation"]}
(run / "production-receipt.json").write_text(json.dumps(receipt, indent=2)+"\n")
print(json.dumps(receipt), flush=True)
