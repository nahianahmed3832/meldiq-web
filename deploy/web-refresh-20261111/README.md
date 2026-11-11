# Messages, Later and multiple tabs — production publication

Published to <https://web.meldiq.app/> on **11 November 2026 at 07:14 UTC** (15:14 Asia/Shanghai). The exact previously tested export was promoted with device test linking disabled. No rebuild or application-code change was made during publication.

| Item                        | Value                                                                 |
| --------------------------- | --------------------------------------------------------------------- |
| Release source              | `0a10869b0e5691588573205808cc400c7bf14bc7`                            |
| Tested application source   | `daf70d5e3b41ddfc04e012519b39b8fc667e8f8a`                            |
| Build ID                    | `kwy5JIg3ctDKrxSpSwP8t`                                               |
| Previous build ID           | `ml6QfuxEmtaayIlYfbFdW`                                               |
| Release directory           | `/opt/meldiq-web/releases/0.5.0-beta-web-refresh-0a10869b`            |
| Retained predecessor        | `/opt/meldiq-web/releases/0.5.0-beta-pricing-catalog-68108747`        |
| Origin                      | Existing Frankfurt EC2 production host                                |
| GitHub branch               | `codex/web-refresh-release-20261111`                                  |
| Commit author and committer | MD.NAHIAN AHMED, `254077813+nahianahmed3832@users.noreply.github.com` |

## Publication basis and remaining qualification

The user explicitly requested production publication and a GitHub push after receiving the [readiness assessment](../../docs/design/RELEASE_READINESS_2026-11-11.md). This is an owner-directed publication with known qualification gaps. It is **not a passing full release-workflow result**; validators and workflow requirements were not changed.

The recorded gaps remain: 24 inherited formatting failures; 77 older missing translation keys in each of 26 locales; pending physical iOS/Android keyboard and native-language reviews. All 19 scoped translation keys are complete in all 28 locales. Local verification used Node 25.8.0; repository CI pins 22.22.3, and remote CI was not invoked.

The earlier qualification passed type checking, lint, production build, icon validation, 1,023 unit tests and 74 browser cases. Intentional skips were one unit case and eight platform-specific browser cases. Those browser cases cover multiple tabs, account boundaries, messaging, Saved/collections, localized layouts, offline recovery and a real preceding-build PWA upgrade; see the readiness report for their exact scope and limitations.

## Deployment verification

- All 479 tested export files were rehashed before packaging. The existing production `robots.txt` was added as the only static overlay, yielding 480 manifest files. Runtime configuration and source maps were excluded from the package.
- The existing publisher's hash was verified. The encrypted artifact upload's server checksum matched the local archive. Deployment acquired both production locks, checked the current predecessor and live configuration, retained existing immutable assets, and switched the release symlink atomically.
- The publisher checked all installed manifest hashes and all served JavaScript, CSS, JSON, index, manifest and overlay responses. The predecessor remains available for rollback.
- Independent postflight verified the exact API image stayed `sha256:a999cdb9dfa4d658947752c96691b5a27de19301973dfb180e6610177e6e2ad5`. API 0.76.1, PostgreSQL/Supabase mode, Redis and LiveKit were healthy. Runtime configuration, OAuth callback and container nginx configuration were preserved. No API image, database schema or hosting configuration was changed.
- **439/439 ordinary public HTTP requests passed**, including `/`, `/friends`, `/dms`, `/later`, the service worker, current assets and three previous immutable assets. HTML and worker responses used `no-cache`; runtime configuration used `no-store`. Public responses already served the candidate, so no CloudFront invalidation or cache-policy change was needed.
- An existing signed-in browser session initially opened an older cached build. A normal reload loaded the deployed build without clearing storage or unregistering the worker. Two simultaneous tabs then displayed the new Later and Friends views with independent routes and no observed console errors or warnings. No production content actions were submitted.

The first read-only preflight used an unresolved alias and stopped before any production write. The corrected check resolved `/opt/meldiq-web` to the host's existing `/opt/meldiq-phase6/staged/source/opt/meldiq-web` tree. This historical directory name does not indicate a staging environment; it is the active production installation. The rollback helper likewise resolves both release paths before enforcing its directory guard.

Evidence: [release manifest](RELEASE.json), [publisher receipt](production-receipt.json), [independent host postflight](postflight.json), [public HTTP checks](public-http-verification.json), and [browser observations](public-browser-verification.json). These records contain hashes and verification outcomes, not credentials, runtime configuration contents, private conversations or raw browser snapshots.

## Rollback

The deployed evidence directory contains the exact manifest and [guarded rollback helper](rollback.py). On the existing production host, an authorized operator can run:

```sh
python3 /opt/meldiq-web/release-evidence/web-refresh-0a10869b/rollback.py \
  /opt/meldiq-web/release-evidence/web-refresh-0a10869b
```

The helper requires this release to remain current, checks the predecessor's HTML and unchanged runtime configuration, takes both deployment locks, retains the candidate's immutable assets for already-open tabs, and atomically restores the predecessor. It verifies the restored HTML directly at the origin. After a rollback, verify the previous build through the public CDN, worker freshness and API health. Stop for review if another release has become current; do not override its guard. Rollback was prepared but not executed.

The local operator package, upload checksum and command receipts are retained at `/Users/nahian/Documents/Codex/2026-11-11/outputs/meldiq-web-production-20261111`. The original dirty checkout was preserved throughout.
