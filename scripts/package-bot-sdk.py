#!/usr/bin/env python3
"""Package only pinned, committed first-party bot sources. This is a release-preparation step, not hosted execution."""
import argparse
import hashlib
import io
import json
import os
import pathlib
import re
import subprocess
import zipfile

root = pathlib.Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--server-repo', type=pathlib.Path)
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
repo = args.server_repo or pathlib.Path(os.environ.get('ORBIT_SERVER_DIR', root.parent / 'meldiq_android' / 'server')).parent
pin = (root / 'test/contract-source.txt').read_text().strip()
if not re.fullmatch(r'[a-f0-9]{40}', pin):
    raise SystemExit('A full committed API revision is required in test/contract-source.txt')

def git(*arguments):
    return subprocess.run(['git', '-C', str(repo), *arguments], check=True, stdout=subprocess.PIPE).stdout

if git('cat-file', '-t', pin).strip() != b'commit':
    raise SystemExit('The pinned API revision is not a commit')
files = {}
sdk = ['README.md', 'javascript/package.json', 'javascript/index.mjs', 'javascript/transport.mjs', 'javascript/gateway.mjs', 'python/meldiq_bot.py', 'examples/commands.mjs', 'examples/commands.py']
for name in sdk:
    files[name] = git('show', f'{pin}:server/sdk/{name}')
for name in ['openapi.json', 'bot-gateway.schema.json']:
    files['docs/api/' + name] = git('show', f'{pin}:docs/api/{name}')

buffer = io.BytesIO()
with zipfile.ZipFile(buffer, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for name, content in sorted(files.items()):
        info = zipfile.ZipInfo('meldiq-bot-sdk-preview/' + name, (1980, 1, 1, 0, 0, 0))
        info.create_system = 3
        info.external_attr = 0o100644 << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        archive.writestr(info, content, compresslevel=9)
payload = buffer.getvalue()
with zipfile.ZipFile(io.BytesIO(payload)) as archive:
    if archive.testzip() is not None:
        raise SystemExit('Archive integrity check failed')
manifest = {
    'format': 1, 'apiCommit': pin, 'status': 'preview source clients',
    'archiveSha256': hashlib.sha256(payload).hexdigest(),
    'files': [{'path': name, 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)} for name, data in sorted(files.items())],
}
outputs = {
    'meldiq-bot-sdk-preview.zip': payload,
    'bot-sdk/README.txt': files['README.md'],
    'bot-sdk/manifest.json': (json.dumps(manifest, indent=2) + '\n').encode(),
}
for name, content in outputs.items():
    destination = root / 'public/developers' / name
    if args.check:
        if not destination.exists() or destination.read_bytes() != content:
            raise SystemExit('SDK artifact differs from its pinned source: ' + name)
    else:
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)
print(json.dumps({'mode': 'check' if args.check else 'package', 'apiCommit': pin, 'files': len(files), 'bytes': len(payload), 'sha256': manifest['archiveSha256']}))
