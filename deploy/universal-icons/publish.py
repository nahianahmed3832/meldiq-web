"""Publish a verified static export while preserving the live API and configuration."""
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

os.umask(0o077)
run = Path(sys.argv[1]).resolve()
plan = json.loads((run / 'RELEASE.json').read_text())
locks = [open(p, 'a+') for p in ['/run/lock/meldiq-production-release.lock', '/opt/meldiq-web/.deploy.lock']]
for lock in locks:
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
link = Path('/opt/meldiq-web/current')
old = link.resolve()
new = Path(plan['newWeb'])
assert new.parent == old.parent == Path('/opt/meldiq-web/releases')

def sha(data):
    return hashlib.sha256(data).hexdigest()

def command(args):
    return subprocess.check_output(args, stderr=subprocess.PIPE)

def api():
    return json.loads(command(['docker', 'inspect', 'griip-internal-messaging-api-1']))[0]

def switch(target):
    temp = link.with_name('universal-icons-next')
    assert not temp.exists() and not temp.is_symlink()
    temp.symlink_to(target)
    os.replace(temp, link)

def served(path):
    return command(['curl', '-fsS', '--connect-timeout', '5', '--max-time', '20', '--resolve', 'web.meldiq.app:443:127.0.0.1', 'https://web.meldiq.app/' + path])

assert str(old) == plan['expectedWeb']
assert sha((old / 'index.html').read_bytes()) == plan['expectedHtmlSha256']
assert sha(served('index.html')) == plan['expectedHtmlSha256']
assert not new.exists()
assert sha((run / 'web.tar.gz').read_bytes()) == plan['archiveSha256']
before = api()
assert before['Image'] == plan['expectedApiImageId'] and before['Id'] == plan['expectedApiContainerId']
assert before['State']['Health']['Status'] == 'healthy'
nginx = command(['nginx', '-T'])
config = (old / 'config.json').read_bytes()
assert sha(config) == plan['expectedConfigSha256']
assert json.loads(config)['environment'] == 'production'
callback = served('social-auth-callback.js')
assert sha(callback) == plan['expectedCallbackSha256']
new.mkdir()
with tarfile.open(run / 'web.tar.gz') as bundle:
    bundle.extractall(new, filter='data')
assert not any(path.is_symlink() for path in new.rglob('*'))
assert {str(p.relative_to(new)) for p in new.rglob('*') if p.is_file()} == set(plan['files'])
for path, digest in plan['files'].items():
    assert not Path(path).is_absolute() and '..' not in Path(path).parts
    assert sha((new / path).read_bytes()) == digest, path
assert not list(new.rglob('*.map')) and not (new / 'config.json').exists()
(new / 'config.json').write_bytes(config)

def retain(source, destination):
    if Path(destination).exists():
        assert sha(Path(source).read_bytes()) == sha(Path(destination).read_bytes()), 'Hashed asset collision'
        return destination
    return shutil.copy2(source, destination)

for folder in ['_next/static', 'locales']:
    shutil.copytree(old / folder, new / folder, dirs_exist_ok=True, copy_function=retain, ignore=shutil.ignore_patterns('*.map'))
command(['chmod', '-R', 'a+rX', str(new)])
try:
    switch(new)
    for path, digest in plan['files'].items():
        if path in ['index.html', 'sw.js'] or path.endswith(('.js', '.css', '.json', '.txt')):
            assert sha(served(path)) == digest, path
    assert served('config.json') == config
    assert served('social-auth-callback.js') == callback
    assert command(['nginx', '-T']) == nginx
    after = api()
    assert after['Id'] == before['Id'] and after['Image'] == before['Image']
    assert after['State']['Health']['Status'] == 'healthy'
    health = json.loads(command(['curl', '-fsS', '--max-time', '10', 'http://127.0.0.1:18080/healthz']))
    assert health['ok']
except BaseException:
    for folder in ['_next/static', 'locales']:
        shutil.copytree(new / folder, old / folder, dirs_exist_ok=True, copy_function=retain)
    switch(old)
    raise
receipt = {'status': 'deployed-and-verified', 'deployedAt': datetime.datetime.now(datetime.UTC).isoformat(), 'sourceCommit': plan['sourceCommit'], 'sourceTreeSha256': plan['sourceTreeSha256'], 'previousWeb': str(old), 'webRelease': str(new), 'buildId': plan['buildId'], 'archiveSha256': plan['archiveSha256'], 'apiPreserved': True, 'apiImageId': after['Image'], 'apiContainerId': after['Id'], 'publicConfigPreserved': True, 'nginxPreserved': True, 'oauthCallbackPreserved': True, 'health': health, 'previousStaticAssetsRetained': True, 'verifiedFileCount': len(plan['files']), 'validation': plan['validation']}
(run / 'production-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt), flush=True)
