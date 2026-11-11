# Reproduce the candidate and local qualification

These are local disposable-data commands. Run from a new checkout, not the preserved dirty main worktree. The full release gates currently fail on inherited formatting/localization debt; this procedure does not waive them.

## Source

The output package's `source-patches/` is an ordered `git format-patch` series based on `68108747dbb57d193a2be242cf6148c275a7c717`. The first three patches produce tested code commit `daf70d5e3b41ddfc04e012519b39b8fc667e8f8a`'s tree (`87ffadc50d307ab0c4d5b534e2404aeeb3cd8eeb`); a later documentation patch adds evidence only.

```sh
# Set this to the durable output folder containing source-patches/ and builds/.
MELDIQ_EVIDENCE=/Users/nahian/Documents/Codex/2026-11-11/outputs/meldiq-release-readiness-20261111
# Choose a new, unused worktree path.
git -C /Volumes/code_files/meldiq_web worktree add --detach /Volumes/code_files/meldiq_refresh_reproduce 68108747dbb57d193a2be242cf6148c275a7c717
cd /Volumes/code_files/meldiq_refresh_reproduce
git am "$MELDIQ_EVIDENCE"/source-patches/000[123]-*.patch
git rev-parse 'HEAD^{tree}'
# Must equal 87ffadc50d307ab0c4d5b534e2404aeeb3cd8eeb before applying documentation-only patches.
npm ci --no-audit --no-fund
```

The accompanying Git bundle preserves the original candidate commit IDs and requires the documented base objects. `git bundle verify <bundle>` validates its prerequisites; fetch its recorded branch into a new branch/worktree if exact original commit identity is needed. Patch reconstruction may create different committer timestamps but must produce the same tree. A recompiled Next build normally has a different build ID; use the supplied export when reproducing the exact recorded build ID.

Use the intended API revision, not whichever neighboring checkout happens to exist:

```sh
git -C /Volumes/code_files/meldiq_android worktree add --detach /Volumes/code_files/meldiq_refresh_api_reproduce b4bb6cff391325737fe33a7a4149b28ffaff4bf6
export ORBIT_SERVER_DIR=/Volumes/code_files/meldiq_refresh_api_reproduce/server
(cd "$ORBIT_SERVER_DIR" && npm ci --no-audit --no-fund)
```

## Disposable PostgreSQL

Requires local `initdb`, `pg_ctl`, `createdb` and `psql` (tested with PostgreSQL 17.11). Choose an unused loopback port; this example uses 55419. Do not point any command at a hosted/production database. The bootstrap mocks only local Supabase SQL roles/auth/realtime contracts.

```sh
MELDIQ_QA_DB_DIR=$(mktemp -d)
initdb --auth=trust --username=meldiq_release_check -D "$MELDIQ_QA_DB_DIR/data"
pg_ctl -D "$MELDIQ_QA_DB_DIR/data" -l "$MELDIQ_QA_DB_DIR/postgres.log" -o '-h 127.0.0.1 -p 55419' -w start
for MELDIQ_QA_DB in meldiq_refresh meldiq_refresh_pwa; do
  createdb -h 127.0.0.1 -p 55419 -U meldiq_release_check "$MELDIQ_QA_DB"
  MELDIQ_QA_URL="postgres://meldiq_release_check@127.0.0.1:55419/$MELDIQ_QA_DB"
  psql "$MELDIQ_QA_URL" -X -v ON_ERROR_STOP=1 -1 -f scripts/supabase/postgres-bootstrap.sql
  for MELDIQ_QA_SQL in supabase/migrations/*.sql; do
    psql "$MELDIQ_QA_URL" -X -v ON_ERROR_STOP=1 -1 -f "$MELDIQ_QA_SQL"
  done
done
export DATABASE_MODE=supabase
export SUPABASE_DATABASE_URL=postgres://meldiq_release_check@127.0.0.1:55419/meldiq_refresh
```

Playwright starts the real API with a fresh temporary `ORBIT_E2E_DATA`, development/file mail, generated participants and loopback proxy trust. API/Next/static server ports are configurable. No real email, paid service or production credentials are required. Do not retain that temporary data directory or raw traces in release artifacts.

## Required gates and interception suites

```sh
npm run typecheck
npm run lint
npm run format:check                 # Currently fails on 24 inherited files.
npm test -- --maxWorkers=2          # Full suite; bounded concurrency avoids local contention.
npm run i18n:validate
npm run i18n:check                   # Currently fails on the 77 older keys in 26 locales.
node scripts/i18n/check-refresh.mjs /tmp/meldiq-new-string-coverage.json
npm run icons:check
python3 scripts/icons/test_catalogue.py
git diff --check
npx playwright test e2e/web-refresh.spec.ts e2e/web-refresh-localization.spec.ts e2e/multiple-accounts.spec.ts e2e/dms-selection.spec.ts e2e/cross-device.spec.ts \
  --project=chromium --project=firefox --project=webkit --project=phone-width --project=iphone-width
```

The failure-injection refresh/account/localization suites intentionally block workers. The DMs suite retains its original desktop-Chromium policy; eight skips across the five selected projects are expected. The 15 cross-device cases cover the reference phone, revocation and five same-account tabs with delivery, draft isolation and connection handoff. This is not physical-phone testing.

## Production build and real update check

Build after stopping `next dev` in that checkout, or use a separately reconstructed worktree as this run did. Both servers write `.next` and should not share it concurrently.

```sh
NEXT_PUBLIC_MELDIQ_TEST_LINKING=0 npm run build
# Verify no .map or config.json exists in dist/ before packaging it.
MELDIQ_PREVIOUS=$(mktemp -d)
tar -xzf "$MELDIQ_EVIDENCE/builds/previous-export.tar.gz" -C "$MELDIQ_PREVIOUS"
# The release server checks all 480 predecessor files against this manifest on every run.
LIVEKIT_SERVER_BIN= \
SUPABASE_DATABASE_URL=postgres://meldiq_release_check@127.0.0.1:55419/meldiq_refresh_pwa \
ORBIT_E2E_API_PORT=8093 ORBIT_E2E_WEB_PORT=5183 \
ORBIT_E2E_BUILD=1 ORBIT_E2E_PREBUILT=1 ORBIT_E2E_TEST_LINKING=0 ORBIT_E2E_RELEASE=1 \
ORBIT_E2E_PREVIOUS_DIST="$MELDIQ_PREVIOUS/dist" \
ORBIT_E2E_PREVIOUS_MANIFEST="$MELDIQ_PREVIOUS/payload/RELEASE.json" \
  npx playwright test e2e/release-pwa.spec.ts --project=chromium
```

`LIVEKIT_SERVER_BIN=` disables only the unused optional calling fixture, avoiding a port conflict when another harness is running. `scripts/pwa-release-server.mjs` creates disposable previous/candidate directories, validates the predecessor, retains immutable assets and serves one `current` symlink with production headers. `e2e/release-pwa.spec.ts` changes that link directly from the test process; it adds no production endpoint or authentication bypass. Traces, video and screenshots are disabled for this signup/account suite. Its assertions/logs retain no tokens, keys, messages or search queries in the evidence package.

To use the exact already-tested candidate rather than regenerate a build ID, unpack `builds/candidate-verification-export.tar.gz` into a separate empty export worktree after validating its archive hash and `candidate-build.json`. The release server expects `dist/` beneath the current working directory. Keep the browser profile/storage and worker intact within the upgrade test.

After the harness exits, stop only the PostgreSQL cluster created above:

```sh
pg_ctl -D "$MELDIQ_QA_DB_DIR/data" -m fast -w stop
```

Remove disposable test data only after inspection and within its recorded temporary directory. The completed run stopped its own database and API/web test servers. It did not stop existing user services or modify the original checkout.
