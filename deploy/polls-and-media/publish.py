"""Install a static web export under the shared lock, with guarded atomic rollback."""
import datetime, fcntl, hashlib, json, os, shutil, subprocess, sys, tarfile
from pathlib import Path
os.umask(0o077)
run = Path(sys.argv[1]).resolve()
m = json.loads((run / "RELEASE.json").read_text())
locks = [open(path, "a+") for path in ["/run/lock/meldiq-production-release.lock", "/opt/meldiq-web/.deploy.lock"]]
for lock in locks:
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
link = Path("/opt/meldiq-web/current")
old, new = Path(m["expectedWeb"]), Path(m["newWeb"])
assert link.resolve() == old, "Production changed; rebuild on the new baseline"
assert not new.exists()
def command(args):
    return subprocess.check_output(args, stderr=subprocess.PIPE)
def digest(data):
    return hashlib.sha256(data).hexdigest()
def served(path):
    return command(["curl", "--connect-timeout", "5", "--max-time", "15", "-fsS", "--resolve", "web.meldiq.app:443:127.0.0.1", "https://web.meldiq.app/" + path])
def api_state():
    return command(["docker", "inspect", "--format", "{{.Id}} {{.Image}} {{.State.Health.Status}} {{.RestartCount}}", "griip-internal-messaging-api-1"])
def switch(target):
    temporary = link.with_name("polls-media-next")
    assert not temporary.exists() and not temporary.is_symlink()
    temporary.symlink_to(target)
    os.replace(temporary, link)
before_api = api_state()
assert b"healthy" in before_api
before_nginx = command(["nginx", "-T"])
assert digest(served("index.html")) == digest((old / "index.html").read_bytes())
assert digest((run / "web.tar.gz").read_bytes()) == m["archiveSha256"]
new.mkdir()
with tarfile.open(run / "web.tar.gz") as archive:
    archive.extractall(new, filter="data")
for relative, expected in m["files"].items():
    assert digest((new / relative).read_bytes()) == expected, relative
shutil.copy2(old / "config.json", new / "config.json")
shutil.copytree(old / "_next/static", new / "_next/static", dirs_exist_ok=True, copy_function=lambda a, b: b if Path(b).exists() else shutil.copy2(a, b))
assert not list(new.rglob("*.map")), "Public source maps must not ship"
assert (old / "config.json").read_bytes() == (new / "config.json").read_bytes()
command(["chmod", "-R", "a+rX", str(new)])
try:
    switch(new)
    for relative in ["index.html", "sw.js", *[f for f in m["files"] if f.endswith((".js", ".css"))]]:
        assert digest(served(relative)) == m["files"][relative], relative
    assert served("config.json") == (old / "config.json").read_bytes()
    assert before_api == api_state(), "Backend state changed during the web release"
    assert before_nginx == command(["nginx", "-T"]), "Nginx configuration changed"
except BaseException:
    switch(old)
    raise
receipt = {"status": "deployed-and-verified", "sourceCommit": m["sourceCommit"], "buildId": m["buildId"], "archiveSha256": m["archiveSha256"], "previousWeb": str(old), "newWeb": str(new), "deployedAt": datetime.datetime.now(datetime.UTC).isoformat(), "runtimeConfigPreserved": True, "previousStaticAssetsRetained": True, "apiContainerUnchanged": True, "nginxUnchanged": True, "sourceMapsPublished": False, "validation": m["validation"]}
(run / "production-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(json.dumps(receipt))
