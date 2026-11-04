# Production deployment — 2026-11-04

The UI standardization is deployed at https://web.meldiq.app.

- Activated: `2026-11-04T04:42:00.648578+00:00` (12:42 Asia/Shanghai).
- Source: `3cc3c032b973ef9f03b7a2c95593cface27e6f32` on `codex/ui-standardization-production`.
- Build: `tE7fCsXBrpB0ZN4UpNM1F`.
- Live release: `/opt/meldiq-web/releases/0.5.0-beta-ui-standardization-3cc3c03`.
- Retained predecessor: `/opt/meldiq-web/releases/0.5.0-beta-no-service-popups-9ffbab9`.
- API container/image, runtime configuration, nginx and server-owned OAuth callback are unchanged. PostgreSQL, Redis and LiveKit health checks passed.
- All 473 new artifact hashes were verified after the atomic symlink switch. Old immutable chunks/locales and the previous release are retained.

The deployable source is `/private/tmp/meldiq-ui-standardization-production`, based on the actual live predecessor `9ffbab9`. The original working copy had older payment/account implementations; this production merge preserves newer Gifts, checkout recovery, order history, card capability gates, free-period/pending-renewal handling, staged sign-in controls and rules-channel safeguards. Do not redeploy the original working copy over this release without integrating that production baseline.

Before activation, the merged source passed **969 unit/contract tests across 142 files (1 skipped)**, type checking, lint, 28-language validation, a production export with test linking disabled, **55 Chromium browser scenarios**, and **8 additional Firefox/iPhone WebKit scenarios**. The frozen build snapshot matched all 1,151 recorded source inputs. Payment cases use explicit API/SDK test doubles; no live charge was performed.

Manifest and publication evidence: [release manifest](../../deploy/ui-standardization/RELEASE.json), [production receipt](../../deploy/ui-standardization/production-receipt.json). Remote evidence is `/opt/meldiq-web/release-evidence/ui-standardization-3cc3c03/`. A guarded rollback script is stored there and in the deployment directory.

Public production smoke checks passed in Chromium desktop, Chromium phone, and WebKit desktop after activation, including email sign-in navigation, reload, matching build IDs, no page errors, no failed build assets, and no horizontal overflow. No customer account was signed into. See [public browser evidence](../../deploy/ui-standardization/public-browser-verification.json).
