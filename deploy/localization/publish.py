"""Publish checked static localization assets and the optional preference-field overlay."""
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

import yaml

os.umask(0o077)
run = Path(sys.argv[1]).resolve()
manifest = json.loads((run / "RELEASE.json").read_text())
assert manifest["validation"]["localizationComplete"] is True
assert len(manifest["validation"]["locales"]) == 28
assert all(value == 100 for value in manifest["validation"]["coverage"].values())
base = Path("/opt/griip-internal-messaging")
link = Path("/opt/meldiq-web/current")
old, new = Path(manifest["expectedWeb"]), Path(manifest["newWeb"])
assert old.parent == new.parent == Path("/opt/meldiq-web/releases")
container = "griip-internal-messaging-api-1"
locks = [open(path, "a+") for path in ["/run/lock/meldiq-production-release.lock", "/opt/meldiq-web/.deploy.lock"]]
for attempt in range(60):
    try:
        for lock in locks:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        break
    except BlockingIOError:
        for lock in locks:
            fcntl.flock(lock, fcntl.LOCK_UN)
        if attempt % 5 == 0:
            print("Waiting for the production release lock", flush=True)
        time.sleep(3)
else:
    raise RuntimeError("Production release lock remains busy")


def command(arguments, data=None):
    return subprocess.check_output(arguments, cwd=base, input=data, stderr=subprocess.PIPE)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def inspect():
    return json.loads(command(["docker", "inspect", container]))[0]


def compose(*arguments):
    return command(["docker", "compose", "-p", "griip-internal-messaging", "-f", "compose.yaml", *arguments])


def switch(target):
    temporary = link.with_name("localization-next")
    assert not temporary.exists() and not temporary.is_symlink()
    temporary.symlink_to(target)
    os.replace(temporary, link)


def served(path):
    return command(["curl", "--connect-timeout", "5", "--max-time", "20", "-fsS", "--resolve", "web.meldiq.app:443:127.0.0.1", "https://web.meldiq.app/" + path])


def healthy():
    for attempt in range(60):
        current = inspect()
        if current["State"].get("Health", {}).get("Status") == "healthy":
            return current
        if attempt % 5 == 0:
            print("Waiting for API health", flush=True)
        time.sleep(2)
    raise RuntimeError("API health deadline exceeded")


def verify_runtime(previous, current):
    assert dict(value.split("=", 1) for value in previous["Config"]["Env"]) == dict(value.split("=", 1) for value in current["Config"]["Env"])
    assert {value["Destination"]: value for value in previous["Mounts"]} == {value["Destination"]: value for value in current["Mounts"]}
    assert previous["HostConfig"]["PortBindings"] == current["HostConfig"]["PortBindings"]


def write_compose(content):
    temporary = base / "compose.localization.tmp"
    temporary.write_bytes(content)
    os.replace(temporary, base / "compose.yaml")


before = inspect()
assert before["Config"]["Image"] == manifest["expectedImage"] and before["Image"] == manifest["expectedImageId"]
assert before["State"]["Health"]["Status"] == "healthy"
assert link.resolve() == old and not new.exists(), "Production predecessor changed"
labels = before["Config"].get("Labels", {})
assert labels["com.docker.compose.project.config_files"] == str(base / "compose.yaml")
assert not labels.get("com.docker.compose.project.environment_file")
assert json.loads(command(["docker", "image", "inspect", manifest["expectedImage"]]))[0]["Id"] == manifest["expectedImageId"]
build_base = manifest.get("buildBaseImage", manifest["expectedImage"])
assert json.loads(command(["docker", "image", "inspect", build_base]))[0]["Id"] == manifest.get("buildBaseImageId", manifest["expectedImageId"])
for path, sha in manifest.get("serverOwnedAssets", {}).items():
    assert digest(served(path)) == sha, "Server-owned callback asset changed"

nginx_before = command(["nginx", "-T"])
others_before = command(["docker", "ps", "--format", "{{.Names}} {{.ID}}"])
(run / "before-inspection.private.json").write_text(json.dumps(before))
original = (base / "compose.yaml").read_bytes()
(run / "compose.before.private.yaml").write_bytes(original)
assert original.decode().count(manifest["expectedImage"]) == 1
assert digest(served("index.html")) == digest((old / "index.html").read_bytes())
for name, sha in manifest["archives"].items():
    assert digest((run / name).read_bytes()) == sha

module_paths = {"shared/contracts/http/preferences.js", "modules/accounts/preferences/schema.js", "modules/accounts/preferences/routes.js"}
assert set(manifest["baselineFiles"]) == module_paths
for module, sha in manifest["baselineFiles"].items():
    assert command(["docker", "exec", container, "sha256sum", "/app/dist/" + module]).decode().split()[0] == sha, "Preference-module baseline changed"
smoke = b"""import assert from 'node:assert/strict';
import {PreferencesBody} from '/app/dist/shared/contracts/http/preferences.js';
import {zNavPrefs,normalizePrefs} from '/app/dist/modules/accounts/preferences/schema.js';
for(const locale of [null,'system','en','bn','hi','ur','zh-CN','zh-TW','ja','ko','id','vi','th','ar','tr','pt-BR','es-419','es-ES','fr','de','it','nl','pl','ru','uk','ro','sv','cs','el','pt-PT']) {
 const body=PreferencesBody.parse({baseRev:0,prefs:{locale}});
 assert.equal(body.prefs.locale,locale);
 assert.equal(zNavPrefs.parse(normalizePrefs(body.prefs,()=>true,()=> 'all')).locale,locale);
}
assert.throws(()=>PreferencesBody.parse({baseRev:0,prefs:{locale:'unsupported'}}));
console.log('Optional locale contract and stored reader verified');"""

# Build both candidates before changing a running service. The reader fallback accepts stored locale fields
# and preserves them on older writes, while omitting the capability from its HTTP responses.
for name, image, hashes in [("api-overlay", manifest["newImage"], manifest["apiFiles"]), ("api-reader", manifest["readerImage"], manifest["readerFiles"])]:
    assert set(hashes) == module_paths
    with tarfile.open(run / (name + ".tar.gz")) as archive:
        archive.extractall(run / name, filter="data")
    directory = run / name
    assert {str(path.relative_to(directory / "dist")) for path in (directory / "dist").rglob("*") if path.is_file()} == module_paths
    for path, sha in hashes.items():
        assert digest((directory / "dist" / path).read_bytes()) == sha
    assert (directory / "Dockerfile").read_text().splitlines()[0] == "FROM " + build_base
    # The bundle itself stays private; copied application code must be readable by the base image's runtime user.
    code = directory / "dist"
    code.chmod(0o755)
    for path in code.rglob("*"):
        path.chmod(0o755 if path.is_dir() else 0o644)
    build = subprocess.run(["docker", "build", "--pull=false", "--network=none", "--memory=256m", "--memory-swap=256m", "--cpu-quota=50000", "--cpu-period=100000", "-t", image, str(directory)], env={**os.environ, "DOCKER_BUILDKIT": "0"}, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    (run / (name + "-build.log")).write_bytes(build.stdout)
    assert build.returncode == 0
    command(["docker", "run", "--rm", "-i", "--network=none", "--memory=128m", "--entrypoint", "node", image, "--input-type=module"], smoke)

assert "config.json" not in manifest["files"]
new.mkdir()
with tarfile.open(run / "web.tar.gz") as archive:
    archive.extractall(new, filter="data")
assert not any(path.is_symlink() for path in new.rglob("*")), "Release contains symlinks"
assert {str(path.relative_to(new)) for path in new.rglob("*") if path.is_file()} == set(manifest["files"]), "Unexpected release files"
for path, sha in manifest["files"].items():
    assert not Path(path).is_absolute() and ".." not in Path(path).parts
    assert digest((new / path).read_bytes()) == sha
assert not list(new.rglob("*.map"))
shutil.copy2(old / "config.json", new / "config.json")


def retain_hashed_asset(source, destination):
    if Path(destination).exists():
        assert digest(Path(source).read_bytes()) == digest(Path(destination).read_bytes()), "Hashed asset collision"
        return destination
    return shutil.copy2(source, destination)


shutil.copytree(old / "_next/static", new / "_next/static", dirs_exist_ok=True, copy_function=retain_hashed_asset, ignore=shutil.ignore_patterns("*.map"))
if (old / "locales").exists():
    shutil.copytree(old / "locales", new / "locales", dirs_exist_ok=True, copy_function=retain_hashed_asset)
command(["chmod", "-R", "a+rX", str(new)])
changed = original.decode().replace(manifest["expectedImage"], manifest["newImage"]).encode()
expected = yaml.safe_load(original)
expected["services"]["api"]["image"] = manifest["newImage"]
assert yaml.safe_load(changed) == expected
api_switched = False
web_switched = False
try:
    write_compose(changed)
    api_switched = True
    compose("up", "-d", "--no-deps", "--no-build", "api")
    current = healthy()
    assert current["Config"]["Image"] == manifest["newImage"]
    for module, sha in manifest["apiFiles"].items():
        assert command(["docker", "exec", container, "sha256sum", "/app/dist/" + module]).decode().split()[0] == sha, "Running preference module differs from its package"
    verify_runtime(before, current)
    switch(new)
    web_switched = True
    for path, sha in manifest["files"].items():
        if path == "index.html" or path == "sw.js" or path.endswith((".js", ".css", ".json")):
            assert digest(served(path)) == sha, path
    assert served("config.json") == (old / "config.json").read_bytes()
    for path, sha in manifest.get("serverOwnedAssets", {}).items():
        assert digest(served(path)) == sha, "Server-owned callback asset changed during publication"

    assert nginx_before == command(["nginx", "-T"])
    def others(data):
        return {line for line in data.decode().splitlines() if not line.startswith(container + " ")}
    assert others(others_before).issubset(others(command(["docker", "ps", "--format", "{{.Names}} {{.ID}}"])))
except BaseException:
    if web_switched:
        shutil.copytree(new / "_next/static", old / "_next/static", dirs_exist_ok=True, copy_function=retain_hashed_asset, ignore=shutil.ignore_patterns("*.map"))
        shutil.copytree(new / "locales", old / "locales", dirs_exist_ok=True, copy_function=retain_hashed_asset)
        shutil.copy2(new / "public-locale.js", old / "public-locale.js")
        switch(old)
    if api_switched:
        # Never restart the old strict reader after locale preferences might have been saved.
        fallback = original.decode().replace(manifest["expectedImage"], manifest["readerImage"]).encode()
        write_compose(fallback)
        compose("up", "-d", "--no-deps", "--no-build", "api")
        verify_runtime(before, healthy())
    raise

receipt = {"status": "deployed-and-verified", "publicationToolSha256": digest(Path(__file__).read_bytes()), "deployedAt": datetime.datetime.now(datetime.UTC).isoformat(), "webSource": manifest["webSource"], "apiSource": manifest["apiSource"], "buildId": manifest["buildId"], "previousWeb": str(old), "newWeb": str(new), "previousApiImage": manifest["expectedImage"], "newApiImage": manifest["newImage"], "compatibleReaderImage": manifest["readerImage"], "apiModulesReplaced": sorted(module_paths), "previousApiImageId": before["Image"], "newApiImageId": current["Image"], "baselineModuleSha256": manifest["baselineFiles"], "apiModuleSha256": manifest["apiFiles"], "compatibleReaderModuleSha256": manifest["readerFiles"], "webArchiveSha256": manifest["archives"]["web.tar.gz"], "verifiedWebFileCount": len(manifest["files"]), "serverOwnedAssetsPreserved": manifest.get("serverOwnedAssets", {}), "buildBaseImage": build_base, "runtimeConfigurationPreserved": True, "databaseMigrationsChanged": False, "nginxUnchanged": True, "otherContainersUnchanged": True, "publicSourceMaps": False, "validation": manifest["validation"]}
(run / "production-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(json.dumps(receipt), flush=True)
