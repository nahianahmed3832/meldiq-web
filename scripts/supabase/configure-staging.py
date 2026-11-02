#!/usr/bin/env python3
"""Interactive private credential setup. Never prints or shell-interpolates the password."""
import getpass
import os
from pathlib import Path
from urllib.parse import quote

PROJECT = 'bkvlxbsnzqkhbifawcww'
DIRECT_HOST = f'db.{PROJECT}.supabase.co'

def main():
    directory = Path.home() / '.local/share/meldiq-supabase'
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    print('Meldiq STAGING only — Frankfurt')
    print('Paste the database password you saved when creating Meldiq Staging.')
    print('Typing is hidden. The password is saved only in a private file outside Git.')
    password = getpass.getpass('Staging database password: ')
    if not password:
        raise SystemExit('Nothing saved: empty password.')
    confirm = getpass.getpass('Paste it once more to confirm: ')
    if password != confirm:
        raise SystemExit('Nothing saved: passwords did not match. Run the command again.')
    filename = directory / 'staging.env'
    # Connection template is verified from the project dashboard. Session pooler supports IPv4.
    host = 'aws-1-eu-central-1.pooler.supabase.com'
    user = f'postgres.{PROJECT}' if host.endswith('.pooler.supabase.com') else 'postgres'
    url = f'postgresql://{user}:{quote(password, safe="")}@{host}:5432/postgres'
    content = '\n'.join([
        'SUPABASE_ENVIRONMENT=staging',
        f'SUPABASE_EXPECTED_PROJECT_REF={PROJECT}',
        f'SUPABASE_PROJECT_REF={PROJECT}',
        f'SUPABASE_DATABASE_URL={url}',
        f'SUPABASE_DB_CA_FILE={directory / "supabase-root.crt"}',
        # URL-encoded password in URL is the only stored representation. No shell sourcing is used.
        '',
    ])
    temporary = directory / 'staging.env.pending'
    fd = os.open(temporary, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, 'w') as target:
        target.write(content)
    os.replace(temporary, filename)
    print('Saved staging configuration privately. No password was printed.')
    print('You can return to Codex and say: saved.')

if __name__ == '__main__':
    main()
