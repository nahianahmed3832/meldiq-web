"""Publish verified community expressions and icon fixes while preserving production state and a code rollback."""
import datetime
import fcntl
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tarfile
import time
from pathlib import Path

os.umask(0o077)
run = Path(sys.argv[1]).resolve()
manifest = json.loads((run / "RELEASE.json").read_text())
base = Path("/opt/griip-internal-messaging")
link = Path("/opt/meldiq-web/current")
old = Path(manifest["expectedWeb"])
new = Path(manifest["newWeb"])
container = "griip-internal-messaging-api-1"
lock = open("/run/lock/meldiq-production-release.lock", "a+")
fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)

def command(args, input=None):
    try:
        return subprocess.check_output(args, input=input, cwd=base, stderr=subprocess.PIPE)
    except subprocess.CalledProcessError as error:
        (run / "last-command.stderr").write_bytes(error.stderr or b"")
        raise

def inspection():
    return json.loads(command(["docker", "inspect", container]))[0]

def compose(*args):
    return command(["docker", "compose", "-p", "griip-internal-messaging", "-f", "compose.yaml", *args])

def switch(target):
    temporary = link.with_name("community-expressions-next")
    assert not temporary.exists() and not temporary.is_symlink()
    temporary.symlink_to(target)
    os.replace(temporary, link)

def served(path):
    return command(["curl", "--connect-timeout", "5", "--max-time", "15", "-fsS", "--resolve", "web.meldiq.app:443:127.0.0.1", "https://web.meldiq.app/" + path])

def wait_healthy():
    for attempt in range(60):
        current = inspection()
        if current["State"].get("Health", {}).get("Status") == "healthy":
            return current
        time.sleep(2)
    raise RuntimeError("API health deadline exceeded")

before = inspection()
assert before["Config"]["Image"] == manifest["expectedImage"]
assert before["Image"] == manifest["expectedImageId"]
assert before["State"]["Health"]["Status"] == "healthy"
assert link.resolve() == old and not new.exists()
for filename, digest in manifest["archives"].items():
    assert hashlib.sha256((run / filename).read_bytes()).hexdigest() == digest
with tarfile.open(run / "api-overlay.tar.gz") as bundle:
    (run / "api-overlay").mkdir()
    bundle.extractall(run / "api-overlay", filter="data")
assert hashlib.sha256(served("index.html")).hexdigest() == hashlib.sha256((old / "index.html").read_bytes()).hexdigest()
(run / "compose.before.yaml").write_bytes((base / "compose.yaml").read_bytes())
(run / "nginx.before.txt").write_bytes(command(["nginx", "-T"]))
with tarfile.open(run / "web.tar.gz") as bundle:
    new.mkdir()
    bundle.extractall(new, filter="data")
for relative, digest in manifest["files"].items():
    assert hashlib.sha256((new / relative).read_bytes()).hexdigest() == digest, relative
shutil.copy2(old / "config.json", new / "config.json")
shutil.copytree(old / "_next/static", new / "_next/static", dirs_exist_ok=True, copy_function=lambda source, target: target if Path(target).exists() else shutil.copy2(source, target))
assert not list(new.rglob("*.map")), "Public source maps are forbidden"
command(["chmod", "-R", "a+rX", str(new)])
env = {**os.environ, "DOCKER_BUILDKIT": "0"}
build = subprocess.run(["docker", "build", "--pull=false", "--network=none", "--memory=256m", "--memory-swap=256m", "--cpu-quota=50000", "--cpu-period=100000", "-t", manifest["newImage"], str(run / "api-overlay")], env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
(run / "image-build.log").write_bytes(build.stdout)
assert build.returncode == 0
smoke = b"import assert from 'node:assert/strict';import * as routes from '/app/dist/modules/organizations/orgsRoutes.js';assert(Object.keys(routes).length>0);console.log('community routes loaded');"
command(["docker", "run", "--rm", "-i", "--network=none", "--memory=128m", "--entrypoint", "node", manifest["newImage"], "--input-type=module"], smoke)
api_switched = False
web_switched = False
try:
    original = (base / "compose.yaml").read_text()
    assert original.count(manifest["expectedImage"]) == 1
    import yaml
    before_compose = yaml.safe_load(original)
    updated = original.replace(manifest["expectedImage"], manifest["newImage"])
    expected = yaml.safe_load(original)
    expected["services"]["api"]["image"] = manifest["newImage"]
    assert yaml.safe_load(updated) == expected
    temporary = base / "compose.community-expressions.tmp"
    temporary.write_text(updated)
    os.chmod(temporary, (base / "compose.yaml").stat().st_mode)
    api_switched = True
    os.replace(temporary, base / "compose.yaml")
    compose("config", "-q")
    compose("up", "-d", "--no-deps", "--no-build", "--pull", "never", "api")
    after = wait_healthy()
    assert sorted(before["Config"]["Env"]) == sorted(after["Config"]["Env"])
    assert sorted(before["Mounts"], key=lambda m: m["Destination"]) == sorted(after["Mounts"], key=lambda m: m["Destination"])
    for key in ["PortBindings", "Memory", "MemorySwap", "NanoCpus", "CpuQuota", "CpuPeriod", "ReadonlyRootfs", "RestartPolicy"]:
        assert before["HostConfig"][key] == after["HostConfig"][key], key
    assert (run / "nginx.before.txt").read_bytes() == command(["nginx", "-T"])
    web_switched = True
    switch(new)
    for relative in manifest["verifyFiles"]:
        assert hashlib.sha256(served(relative)).hexdigest() == manifest["files"][relative], relative
    assert served("config.json") == (old / "config.json").read_bytes()
except BaseException:
    if web_switched:
        switch(old)
    if api_switched:
        shutil.copy2(run / "compose.before.yaml", base / "compose.yaml")
        compose("up", "-d", "--no-deps", "--no-build", "--pull", "never", "api")
        wait_healthy()
    raise
receipt = {**manifest, "status": "deployed-and-verified", "deployedAt": datetime.datetime.now(datetime.UTC).isoformat(), "apiEnvironmentPortsMountsLimitsPreserved": True, "nginxAndWebConfigurationPreserved": True, "previousReleasesRetained": True}
(run / "production-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(json.dumps({key: receipt[key] for key in ["status", "newWeb", "newImage", "deployedAt"]}))
