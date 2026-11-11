"""Restore this web release's predecessor without changing the API or configuration."""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

run = Path(sys.argv[1]).resolve()
plan = json.loads((run / "RELEASE.json").read_text())
locks = [open(p, "a+") for p in ["/run/lock/meldiq-production-release.lock", "/opt/meldiq-web/.deploy.lock"]]
for lock in locks:
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
link = Path("/opt/meldiq-web/current")
old, new = Path(plan["expectedWeb"]).resolve(), Path(plan["newWeb"]).resolve()
assert link.resolve() == new, "A different web release is current; review before rolling back"
assert old.parent == new.parent == Path("/opt/meldiq-web/releases").resolve()
assert hashlib.sha256((old / "index.html").read_bytes()).hexdigest() == plan["expectedHtmlSha256"]
assert (old / "config.json").read_bytes() == (new / "config.json").read_bytes()

def retain(source, destination):
    if Path(destination).exists():
        assert Path(source).read_bytes() == Path(destination).read_bytes(), "Hashed asset collision"
        return destination
    return shutil.copy2(source, destination)

# Tabs already on the new release must still be able to load their lazy chunks.
for folder in ["_next/static", "locales"]:
    shutil.copytree(new / folder, old / folder, dirs_exist_ok=True, copy_function=retain)
temporary = link.with_name("web-refresh-0a10869b-rollback-next")
assert not temporary.exists() and not temporary.is_symlink()
temporary.symlink_to(old)
os.replace(temporary, link)
body = subprocess.check_output(["curl", "-fsS", "--max-time", "20", "--resolve", "web.meldiq.app:443:127.0.0.1", "https://web.meldiq.app/index.html"])
assert hashlib.sha256(body).hexdigest() == plan["expectedHtmlSha256"]
print(json.dumps({"status": "web-rolled-back", "webRelease": str(old), "apiAndDatabaseUnchanged": True}))
