"""Roll back this localization release while preserving locale-bearing preference documents and loaded assets."""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import yaml

os.umask(0o077)
run = Path(sys.argv[1]).resolve()
manifest = json.loads((run / "RELEASE.json").read_text())
locks = [open(path, "a+") for path in ["/run/lock/meldiq-production-release.lock", "/opt/meldiq-web/.deploy.lock"]]
for lock in locks:
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
base = Path("/opt/griip-internal-messaging")
container = "griip-internal-messaging-api-1"

def command(args):
    return subprocess.check_output(args, cwd=base, stderr=subprocess.PIPE)

def inspect():
    return json.loads(command(["docker", "inspect", container]))[0]

def digest(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()

before = inspect()
assert before["Config"]["Image"] in [manifest["newImage"], manifest["readerImage"]], "Another API release is running"
old, new = Path(manifest["expectedWeb"]), Path(manifest["newWeb"])
link = Path("/opt/meldiq-web/current")
assert link.resolve() in [old, new], "Another web release is running"
assert old.parent == new.parent == Path("/opt/meldiq-web/releases")

def retain(source, destination):
    if Path(destination).exists():
        assert digest(Path(source)) == digest(Path(destination)), "Hashed asset collision"
        return destination
    return shutil.copy2(source, destination)

shutil.copytree(new / "_next/static", old / "_next/static", dirs_exist_ok=True, copy_function=retain, ignore=shutil.ignore_patterns("*.map"))
shutil.copytree(new / "locales", old / "locales", dirs_exist_ok=True, copy_function=retain)
shutil.copy2(new / "public-locale.js", old / "public-locale.js")
# Use the compatible reader, never the original strict schema once locale fields may have been saved.
original = (base / "compose.yaml").read_bytes()
current_image = before["Config"]["Image"]
assert original.decode().count(current_image) == 1
changed = original.decode().replace(current_image, manifest["readerImage"]).encode()
expected = yaml.safe_load(original)
expected["services"]["api"]["image"] = manifest["readerImage"]
assert yaml.safe_load(changed) == expected
if current_image != manifest["readerImage"]:
    temporary = base / "compose.localization-rollback.tmp"
    temporary.write_bytes(changed)
    os.replace(temporary, base / "compose.yaml")
    command(["docker", "compose", "-p", "griip-internal-messaging", "-f", "compose.yaml", "up", "-d", "--no-deps", "--no-build", "api"])
    import time
    for attempt in range(60):
        after = inspect()
        if after["State"].get("Health", {}).get("Status") == "healthy":
            break
        time.sleep(2)
    else:
        raise RuntimeError("Compatible reader health deadline exceeded")
    assert dict(value.split("=", 1) for value in before["Config"]["Env"]) == dict(value.split("=", 1) for value in after["Config"]["Env"])
    assert {value["Destination"]: value for value in before["Mounts"]} == {value["Destination"]: value for value in after["Mounts"]}
    assert before["HostConfig"]["PortBindings"] == after["HostConfig"]["PortBindings"]
if link.resolve() != old:
    temporary = link.with_name("localization-rollback-next")
    assert not temporary.exists() and not temporary.is_symlink()
    temporary.symlink_to(old)
    os.replace(temporary, link)
receipt = {"status":"rolled-back", "web":str(old), "apiImage":manifest["readerImage"], "localeDocumentsPreserved":True, "loadedAssetsRetained":True}
(run / "rollback-receipt.json").write_text(json.dumps(receipt, indent=2)+"\n")
print(json.dumps(receipt))
