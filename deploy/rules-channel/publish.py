"""Publish a static rules-channel release; preserve runtime config, nginx and API."""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
from datetime import datetime, timezone

run = Path(sys.argv[1]).resolve()
manifest = json.loads((run / "RELEASE.json").read_text())
locks = [open(path, "a+") for path in ["/run/lock/meldiq-production-release.lock", "/opt/meldiq-web/.deploy.lock"]]
for lock in locks:
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
link = Path("/opt/meldiq-web/current")
old = link.resolve()
new = Path(manifest["newWeb"])
assert str(old) == manifest["expectedWeb"], "Production changed; rebuild against the current release"
assert not new.exists()
sha = lambda data: hashlib.sha256(data).hexdigest()
assert sha((run / "web.tar.gz").read_bytes()) == manifest["archiveSha256"]

def command(args):
    return subprocess.check_output(args, stderr=subprocess.PIPE)

def served(path):
    return command(["curl", "--connect-timeout", "5", "--max-time", "15", "-fsS", "--resolve", "web.meldiq.app:443:127.0.0.1", "https://web.meldiq.app/" + path])

nginx_before = sha(command(["nginx", "-T"]))
api_before = command(["docker", "inspect", "--format", "{{.Image}}", "griip-internal-messaging-api-1"]).decode().strip()
assert sha(served("index.html")) == sha((old / "index.html").read_bytes())
new.mkdir()
with tarfile.open(run / "web.tar.gz") as archive:
    archive.extractall(new, filter="data")
for relative, digest in manifest["files"].items():
    assert sha((new / relative).read_bytes()) == digest, relative
shutil.copy2(old / "config.json", new / "config.json")
shutil.copytree(old / "_next/static", new / "_next/static", dirs_exist_ok=True, copy_function=lambda source, target: target if Path(target).exists() else shutil.copy2(source, target))
assert not list(new.rglob("*.map"))
command(["chmod", "-R", "a+rX", str(new)])

def switch(target):
    temporary = link.with_name("rules-channel-next")
    assert not temporary.exists() and not temporary.is_symlink()
    temporary.symlink_to(target)
    os.replace(temporary, link)

try:
    switch(new)
    assert sha(served("index.html")) == manifest["files"]["index.html"]
    assert sha(served("dms")) == manifest["files"]["index.html"]
    assert sha(served("sw.js")) == manifest["files"]["sw.js"]
    assert served("config.json") == (old / "config.json").read_bytes()
    for relative, digest in manifest["files"].items():
        if relative.endswith((".js", ".css")):
            assert sha(served(relative)) == digest, relative
    assert nginx_before == sha(command(["nginx", "-T"]))
    assert api_before == command(["docker", "inspect", "--format", "{{.Image}}", "griip-internal-messaging-api-1"]).decode().strip()
except BaseException:
    switch(old)
    raise
receipt = {"installedAt": datetime.now(timezone.utc).isoformat(), "previous": str(old), "current": str(new), "sourceCommit": manifest["sourceCommit"], "apiUnchanged": True, "nginxUnchanged": True, "configPreserved": True, "assetHashesVerified": True}
(run / "production-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(json.dumps(receipt, indent=2))
