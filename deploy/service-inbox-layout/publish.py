"""Atomically publish the verified CSS overlay; roll back on any failed verification."""
import datetime
import fcntl
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tarfile
from pathlib import Path

os.umask(0o022)
evidence = Path(sys.argv[1]).resolve()
manifest = json.loads((evidence / "RELEASE.json").read_text())
old = Path(manifest["expectedWeb"])
new = Path(manifest["newWeb"])
current = Path("/opt/meldiq-web/current")
lock = open("/run/lock/meldiq-production-release.lock", "a+")
fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)

def command(args):
    return subprocess.check_output(args)

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def api_state():
    return command(["docker", "inspect", "--format", "{{.Id}} {{.Config.Image}} {{.State.Health.Status}} {{.State.StartedAt}}", "griip-internal-messaging-api-1"])

def served(relative):
    return command(["curl", "--connect-timeout", "5", "--max-time", "15", "-fsS", "--resolve", "web.meldiq.app:443:127.0.0.1", "https://web.meldiq.app/" + relative])

assert current.resolve() == old
before_api = api_state()
assert manifest["expectedApiImage"].encode() in before_api and b" healthy " in before_api
assert not new.exists()
assert digest(evidence / "overlay.tar.gz") == manifest["archiveSha256"]
for relative, expected in manifest["baselineFiles"].items():
    assert digest(old / relative) == expected, relative
assert served("index.html") == (old / "index.html").read_bytes()
shutil.copytree(old, new)
with tarfile.open(evidence / "overlay.tar.gz") as bundle:
    assert sorted(member.name for member in bundle.getmembers()) == sorted(manifest["files"])
    bundle.extractall(new, filter="data")
for relative, expected in manifest["files"].items():
    assert digest(new / relative) == expected, relative
for path in old.rglob("*"):
    if path.is_file() and str(path.relative_to(old)) not in manifest["files"]:
        assert digest(path) == digest(new / path.relative_to(old)), path
command(["chmod", "-R", "a+rX", str(new)])

def switch(target):
    temporary = current.with_name("service-inbox-layout-next")
    assert not temporary.exists() and not temporary.is_symlink()
    temporary.symlink_to(target)
    os.replace(temporary, current)

try:
    switch(new)
    for relative in manifest["files"]:
        assert hashlib.sha256(served(relative)).hexdigest() == manifest["files"][relative], relative
    assert served("config.json") == (old / "config.json").read_bytes()
    assert api_state() == before_api
except BaseException:
    switch(old)
    (evidence / "rolled-back.txt").write_text(datetime.datetime.now(datetime.UTC).isoformat())
    raise
receipt = {
    **manifest,
    "status": "deployed-and-verified",
    "deployedAt": datetime.datetime.now(datetime.UTC).isoformat(),
    "previousReleaseRetained": True,
    "configurationPreserved": True,
    "applicationJavaScriptPreserved": True,
    "apiContainerUnchanged": True,
}
(evidence / "production-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(json.dumps({key: receipt[key] for key in ["status", "newWeb", "buildId", "deployedAt"]}))
