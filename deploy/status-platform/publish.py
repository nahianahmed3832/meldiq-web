"""Publish only the verified static Web export; serialize against all API/Web releases."""
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
import urllib.request

os.umask(0o077)
run = Path(sys.argv[1]).resolve()
plan = json.loads((run / "RELEASE.json").read_text())
locks = [open(p, "a+") for p in ["/run/lock/meldiq-production-release.lock", "/opt/meldiq-web/.deploy.lock"]]
for lock in locks:
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
link = Path("/opt/meldiq-web/current")
old = link.resolve()
new = Path(plan["newWeb"])

def sha(data):
    return hashlib.sha256(data).hexdigest()

def command(args):
    return subprocess.check_output(args, stderr=subprocess.PIPE)

def api():
    return json.loads(command(["docker", "inspect", "griip-internal-messaging-api-1"]))[0]

def switch(target):
    tmp = link.with_name("status-platform-next")
    assert not tmp.exists() and not tmp.is_symlink()
    tmp.symlink_to(target)
    os.replace(tmp, link)

assert str(old) == plan["expectedWeb"] and sha((old / "index.html").read_bytes()) == plan["expectedHtmlSha256"]
assert not new.exists()
assert sha((run / "web.tar.gz").read_bytes()) == plan["archiveSha256"]
before = api()
assert before["Image"] == plan["expectedApiImageId"] and before["State"]["Health"]["Status"] == "healthy"
nginx = command(["nginx", "-T"])
config = (old / "config.json").read_bytes()
new.mkdir()
with tarfile.open(run / "web.tar.gz") as bundle:
    bundle.extractall(new, filter="data")
for path, digest in plan["files"].items():
    assert sha((new / path).read_bytes()) == digest, path
assert not list(new.rglob("*.map")) and not (new / "config.json").exists()
(new / "config.json").write_bytes(config)
# Keep active tabs' old chunks available while their transfer/call finishes.
shutil.copytree(old / "_next/static", new / "_next/static", dirs_exist_ok=True, copy_function=lambda src, dst: dst if Path(dst).exists() else shutil.copy2(src, dst))
command(["chmod", "-R", "a+rX", str(new)])
try:
    switch(new)
    for path in ["index.html", "sw.js"]:
        body = command(["curl", "-fsS", "--connect-timeout", "5", "--max-time", "20", "--resolve", "web.meldiq.app:443:127.0.0.1", "https://web.meldiq.app/" + path])
        assert sha(body) == plan["files"][path], path
    assert command(["nginx", "-T"]) == nginx
    assert (new / "config.json").read_bytes() == config
    after = api()
    assert after["Id"] == before["Id"] and after["Image"] == before["Image"]
    assert after["State"]["Health"]["Status"] == "healthy"
    health = json.load(urllib.request.urlopen("http://127.0.0.1:18080/healthz", timeout=10))
    assert health["ok"] and health["mongodb"] and health["redis"]
except BaseException:
    switch(old)
    raise
receipt = {"status": "deployed-and-verified", "deployedAt": datetime.datetime.now(datetime.UTC).isoformat(), "sourceCommit": plan["sourceCommit"], "previousWeb": str(old), "webRelease": str(new), "archiveSha256": plan["archiveSha256"], "apiPreserved": True, "apiImageId": after["Image"], "publicConfigPreserved": True, "nginxPreserved": True, "health": health}
(run / "production-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(json.dumps(receipt))
