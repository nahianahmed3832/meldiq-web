"""Publish the reviewed API overlay and exact static export under both production locks."""
import datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import time
import urllib.request

os.umask(0o077)
run = Path(sys.argv[1]).resolve()
plan = json.loads((run / "plan.json").read_text())
root = Path("/opt/griip-internal-messaging")
api = "griip-internal-messaging-api-1"
link = Path("/opt/meldiq-web/current")
locks = [open(name, "a+") for name in ["/run/lock/meldiq-production-release.lock", "/opt/meldiq-web/.deploy.lock"]]
for lock in locks:
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)

def command(args, **kwargs):
    return subprocess.check_output(args, stderr=subprocess.PIPE, **kwargs)

def digest(data):
    return hashlib.sha256(data).hexdigest()

def container():
    return json.loads(command(["docker", "inspect", api]))[0]

def memory_reserve():
    available = int(next(line.split()[1] for line in Path("/proc/meminfo").read_text().splitlines() if line.startswith("MemAvailable:")))
    assert available > 2621440, "Preserve 2560 MiB host memory reserve"

def operator(image, script):
    return command(["docker", "run", "--rm", "--no-healthcheck", "-i", "--read-only", "--memory=256m", "--memory-swap=256m", "--cpus=0.5", "--pids-limit=128", "--cap-drop=ALL", "--security-opt=no-new-privileges", "--network=griip-internal-messaging_default", "--volumes-from", api + ":ro", "--env-file", str(root / ".env"), "--env-file", str(root / "database-migration/.env.redis"), "--env", "NODE_OPTIONS=--max-old-space-size=160", "--entrypoint=node", image, "--input-type=module"], input=(run / script).read_bytes())

def recreate():
    command(["docker", "compose", "-p", "griip-internal-messaging", "-f", str(root / "compose.yaml"), "up", "-d", "--no-deps", "--no-build", "--pull", "never", "api"])

def switch(target):
    temporary = link.with_name("media-release-next")
    assert not temporary.exists() and not temporary.is_symlink()
    temporary.symlink_to(target)
    os.replace(temporary, link)

before = container()
assert before["Image"] == plan["expectedImageId"] and before["Config"]["Image"] == plan["expectedImage"]
assert before["State"]["Health"]["Status"] == "healthy" and not before["State"].get("OOMKilled")
assert str(link.resolve()) == plan["expectedWeb"]
backup = json.loads(Path(plan["backupManifest"]).read_text())
assert backup["complete"] and backup["allPayloadDecryptionVerified"] and backup["apiImageId"] == before["Image"]
captured = datetime.datetime.strptime(backup["capturedAt"], "%Y%m%dT%H%M%SZ").replace(tzinfo=datetime.UTC)
assert (datetime.datetime.now(datetime.UTC) - captured).total_seconds() < 3600
memory_reserve()
assert digest((run / "web.tar.gz").read_bytes()) == plan["webArchiveSha256"]
compose = root / "compose.yaml"
original_compose = compose.read_bytes()
(run / "compose.before.yaml").write_bytes(original_compose)
environments = {str(path): digest(path.read_bytes()) for path in [root / ".env", root / "database-migration/.env.redis"]}
nginx = command(["nginx", "-T"])
accounts_before = json.loads(operator(plan["expectedImage"], "runtime-check.mjs"))
assert accounts_before["schema"] == 7
for directory, image in [("api-overlay", plan["newImage"]), ("api-floor", plan["floorImage"])]:
    with (run / (directory + ".log")).open("wb") as log:
        subprocess.run(["docker", "build", "--pull=false", "--network=none", "--memory=256m", "--memory-swap=256m", "--cpu-quota=50000", "--cpu-period=100000", "-t", image, str(run / directory)], stdout=log, stderr=subprocess.STDOUT, check=True, env={**os.environ, "DOCKER_BUILDKIT": "0"})
    memory_reserve()
smoke = b'import assert from "node:assert/strict"; import {VERSION} from "./dist/app/server.js"; import {MONGO_SCHEMA_VERSION} from "./dist/infrastructure/database/mongo/client.js"; assert.equal(MONGO_SCHEMA_VERSION,8); console.log(JSON.stringify({version:VERSION,schema:MONGO_SCHEMA_VERSION}));'
for image in [plan["newImage"], plan["floorImage"]]:
    command(["docker", "run", "--rm", "-i", "--network=none", "--memory=192m", "--env", "NODE_OPTIONS=--max-old-space-size=128", "--entrypoint=node", image, "--input-type=module"], input=smoke)
# Apply only nullable metadata and indexes before replacing the API, without starting jobs or a second writer.
(run / "schema-bootstrap.json").write_bytes(operator(plan["newImage"], "bootstrap-schema.mjs"))
new_web = Path(plan["newWeb"])
old_web = Path(plan["expectedWeb"])
assert not new_web.exists()
new_web.mkdir()
with tarfile.open(run / "web.tar.gz") as archive:
    archive.extractall(new_web, filter="data")
for relative, expected in plan["webFiles"].items():
    assert digest((new_web / relative).read_bytes()) == expected, relative
assert not list(new_web.rglob("*.map")) and not (new_web / "config.json").exists()
shutil.copy2(old_web / "config.json", new_web / "config.json")
shutil.copytree(old_web / "_next/static", new_web / "_next/static", dirs_exist_ok=True, copy_function=lambda src, dst: dst if Path(dst).exists() else shutil.copy2(src, dst))
command(["chmod", "-R", "a+rX", str(new_web)])
switched_api = False
try:
    text = original_compose.decode()
    assert text.count(plan["expectedImage"]) == 1
    changed = text.replace(plan["expectedImage"], plan["newImage"])
    import yaml
    expected_compose = yaml.safe_load(text)
    expected_compose["services"]["api"]["image"] = plan["newImage"]
    assert yaml.safe_load(changed) == expected_compose
    temporary = compose.with_suffix(".media.tmp")
    temporary.write_text(changed)
    os.chmod(temporary, compose.stat().st_mode)
    os.replace(temporary, compose)
    command(["docker", "compose", "-p", "griip-internal-messaging", "-f", str(compose), "config", "-q"])
    switched_api = True
    recreate()
    for _ in range(60):
        if container()["State"].get("Health", {}).get("Status") == "healthy":
            break
        time.sleep(2)
    after = container()
    assert after["State"]["Health"]["Status"] == "healthy" and not after["State"].get("OOMKilled")
    assert sorted(before["Config"]["Env"]) == sorted(after["Config"]["Env"])
    assert before["HostConfig"]["PortBindings"] == after["HostConfig"]["PortBindings"]
    assert sorted(before["Mounts"], key=lambda item: item["Destination"]) == sorted(after["Mounts"], key=lambda item: item["Destination"])
    accounts_after = json.loads(operator(plan["newImage"], "runtime-check.mjs"))
    assert accounts_after["schema"] == 8 and accounts_after["fileMaxBytes"] == 1000000000
    assert all(accounts_after["accounts"].get(key) == value for key, value in accounts_before["accounts"].items())
    health = json.load(urllib.request.urlopen("http://127.0.0.1:18080/healthz", timeout=10))
    assert health["ok"] and health["mongodb"] and health["redis"] and health["version"] == "0.76.1"
    switch(new_web)
    for relative in ["index.html", "sw.js"]:
        served = command(["curl", "--connect-timeout", "5", "--max-time", "15", "-fsS", "--resolve", "web.meldiq.app:443:127.0.0.1", "https://web.meldiq.app/" + relative])
        assert digest(served) == plan["webFiles"][relative]
    assert (old_web / "config.json").read_bytes() == (new_web / "config.json").read_bytes()
    assert nginx == command(["nginx", "-T"])
    assert all(digest(Path(path).read_bytes()) == expected for path, expected in environments.items())
    memory_reserve()
except BaseException:
    if link.resolve() == new_web:
        switch(old_web)
    if switched_api:
        # Keep schema 8 and its metadata-aware file stores; never start a schema-7 binary after this migration.
        compose.write_text(original_compose.decode().replace(plan["expectedImage"], plan["floorImage"]))
        recreate()
    raise
receipt = {"status": "deployed-and-verified", "deployedAt": datetime.datetime.now(datetime.UTC).isoformat(), "apiSourceCommit": plan["apiSourceCommit"], "webSourceCommit": plan["webSourceCommit"], "apiImageId": after["Image"], "apiVersion": health["version"], "schema": 8, "atlasDomains": 16, "fileMaxBytes": 1000000000, "webRelease": str(new_web), "webArchiveSha256": plan["webArchiveSha256"], "backupManifest": plan["backupManifest"], "existingAccountsPreserved": len(accounts_before["accounts"]), "environmentPortsMountsPreserved": True, "nginxPreserved": True, "publicConfigPreserved": True, "restartCount": after["RestartCount"], "health": health}
(run / "production-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(json.dumps(receipt), flush=True)
