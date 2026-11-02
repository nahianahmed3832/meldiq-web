#!/usr/bin/env python3
"""Add a staging-only server API key to the existing private env, without echoing it."""
import getpass
import os
from pathlib import Path

file = Path.home() / '.local/share/meldiq-supabase/staging.env'
if not file.exists():
    raise SystemExit('Configure the staging database first.')
print('Meldiq STAGING server API key only — never the production project key.')
print('In Supabase: Meldiq Staging → Project Settings → API Keys → Secret key.')
key = getpass.getpass('Paste the staging sb_secret_ key (hidden): ').strip()
if not key.startswith('sb_secret_') or not all(c.isalnum() or c in '_-' for c in key):
    raise SystemExit('Nothing saved: a new-format staging sb_secret_ key is required.')
lines = [line for line in file.read_text().splitlines() if not line.startswith('SUPABASE_SECRET_KEY=')]
lines.append('SUPABASE_SECRET_KEY=' + key)
tmp = file.with_name('staging-auth.env.pending')
fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as target:
    target.write('\n'.join(lines) + '\n')
os.replace(tmp, file)
print('Saved privately. The key was not printed. Return to Codex and say: auth key saved.')
