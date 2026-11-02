#!/usr/bin/env python3
"""Read-only Atlas snapshot to an encrypted local pipe. Never writes a production database or plaintext dump."""
import datetime
import gzip
import hashlib
import json
import os
from pathlib import Path
import subprocess

os.umask(0o077)
root = Path(__file__).resolve().parents[2]
private = Path.home() / '.local/share/meldiq-supabase'
key = private / 'recovery-keys/staging-age-identity.txt'
if not key.is_file() or key.stat().st_mode & 0o077:
    raise SystemExit('Private recovery identity required')
source = (root.parent / 'meldiq_supabase_migration/server/scripts/database-backup.mjs').read_text()
# Retain the reviewed dump implementation only. The executed program contains no restore/write branch.
source = source[:source.index('async function restore()')]
source = source.replace('const mode = process.argv[2] || "dump";', '')
source = source.replace('await write({ type: "complete", totals });', 'await write({ type: "complete", totals, snapshotTime: session.snapshotTime?.toString() });')
source += '\ndump().catch(() => { console.error("Atlas read-only snapshot failed"); process.exitCode = 1; });\n'
directory = private / ('atlas-rehearsal-' + datetime.datetime.now(datetime.UTC).strftime('%Y%m%dT%H%M%SZ'))
directory.mkdir(mode=0o700)
payload = directory / 'atlas.ejson.gz.age'
recipient = subprocess.check_output(['age-keygen', '-y', str(key)], stderr=subprocess.DEVNULL, text=True).strip()
remote = "flock -s -n /run/lock/meldiq-production-release.lock docker exec -i griip-internal-messaging-api-1 node --max-old-space-size=256 --input-type=module"
incoming = subprocess.Popen(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', 'root@72.60.107.88', remote], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
encrypted = subprocess.Popen(['age', '-r', recipient, '-o', str(payload)], stdin=subprocess.PIPE, stderr=subprocess.DEVNULL)
digest = hashlib.sha256()
try:
    incoming.stdin.write(source.encode()); incoming.stdin.close()
    while chunk := incoming.stdout.read(65536):
        digest.update(chunk); encrypted.stdin.write(chunk)
    incoming.stdout.close(); encrypted.stdin.close()
    if incoming.wait() or encrypted.wait():
        raise RuntimeError('Incomplete snapshot; encrypted partial output retained')
    decrypted = subprocess.Popen(['age', '-d', '-i', str(key), str(payload)], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    verified = hashlib.file_digest(decrypted.stdout, 'sha256').hexdigest()
    decrypted.stdout.close()
    if decrypted.wait() or verified != digest.hexdigest():
        raise RuntimeError('Encrypted snapshot verification failed')
    check = subprocess.Popen(['age', '-d', '-i', str(key), str(payload)], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    header = complete = None
    counts = {}
    with gzip.GzipFile(fileobj=check.stdout) as stream:
        for line in stream:
            record = json.loads(line)
            if complete is not None: raise RuntimeError('Trailing snapshot content')
            if record['type'] == 'header':
                if header is not None or record['format'] != 'meldiq-ejson-snapshot-v1': raise RuntimeError('Invalid snapshot header')
                header = record; counts = {c['name']: 0 for c in header['collections']}
            elif record['type'] == 'document' and header:
                counts[record['collection']] += 1
            elif record['type'] == 'complete' and header:
                complete = record
            else: raise RuntimeError('Invalid snapshot stream')
    check.stdout.close()
    if check.wait() or not complete or not complete.get('snapshotTime') or len(counts) != len(complete['totals']) or any(counts[t['collection']] != t['count'] for t in complete['totals']):
        raise RuntimeError('Incomplete snapshot inventory')
    report = {'ok': True, 'observedAt': datetime.datetime.now(datetime.UTC).isoformat(), 'sourceReadOnly': True,
              'sourceRemainsLive': True, 'pointInTimeSnapshot': True, 'snapshotTime': complete['snapshotTime'],
              'collections': len(counts), 'records': sum(counts.values()), 'encryptedBytes': payload.stat().st_size,
              'compressedPlaintextSha256': verified, 'ciphertextSha256': hashlib.file_digest(payload.open('rb'), 'sha256').hexdigest(),
              'privateDirectory': str(directory), 'destinationImported': False, 'productionChanged': False}
    (directory / 'snapshot-receipt.json').write_text(json.dumps(report, indent=2) + '\n')
    (root / 'docs/testing/supabase-real-data-snapshot.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report), flush=True)
finally:
    for child in (incoming, encrypted):
        if child.poll() is None: child.terminate()
