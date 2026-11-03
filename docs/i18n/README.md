# Meldiq interface localization — 2026-11-04

**All localization and selected browser gates passed. The normal production package and publication are the remaining release steps. Professional native-speaker review remains pending.**

The application has **6,179 translation keys in each of 28 locales**, arranged into 13 namespaces: common, auth, onboarding, workspace, messaging, calls, files, organization, settings, notifications, billing, errors and admin. The strict gate checks dictionary completeness, native plural categories, interpolation types and multiplicity, protected names, line structure, copied English values and prose fragments, malformed output, hardcoded render strings, standalone HTML/JavaScript, and accessible control labels. Intentional shared spellings are reviewed per key and locale in `locales/invariants.json`.

## Architecture and scope

The existing application uses Next.js 16.4.3, React 19.3.1, the Pages Router, static export, a client-only application root and History API routes. The installed Next.js Custom App, Custom Document, internationalization and static-export guides were read before the changes. No framework upgrade or built-in locale routing was introduced. `next-intl` 4.14.9 provides ICU messages and a client provider. English is the eager, typed fallback; the selected locale's JSON namespaces are loaded as same-origin chunks and cached. No translation API, paid service, model, external font CDN or runtime authoring dependency is included.

Static interfaces were extracted across authentication and recovery, device setup/onboarding, navigation and profiles, friends and conversations, composer/messages/reactions/threads/search, calls and media controls, files/uploads/downloads, communities/channels/roles/moderation/invitations/audit, organization settings/bots/developer tools, discovery/lobbies/events, notifications/service inbox, appearance/accessibility/security/storage/health, points/leaderboards/creators, billing/checkout/gifts/Sparks and the existing in-repository administration/operations controls. Standalone invitation and provider-return pages use a small build-derived subset of the same catalogs. Their hashed dictionaries/scripts are retained across forward deployment and rollback. Provider receipts are parsed, removed from the fragment and relayed synchronously; dictionary loading is independent.

The source audit includes rendered local expressions and functions, attributes, error fallbacks, SDK accessibility labels and public-page literals. Protocol values, IDs, routes, CSS/SVG, cryptographic formats, keyboard notation, code/document references and command examples remain technical data. Known built-in labels are translated only when their original audited identifier or value matches. Unknown future server values retain a readable fallback. User messages, names, community descriptions, file names, URLs and other user-authored content remain literal. Cached conversation previews retain semantic descriptors so language switches do not freeze old interface text or mistake a user named “You” for a self label.

The separate public marketing site, external administration repositories, Android and Windows source/distribution are outside this web repository change. Existing optional chat translation remains separate from interface localization.

## Selection, persistence, RTL and formatting

The picker uses native language names, search, selected state, keyboard navigation, Escape and focus restoration. It is available before sign-in, during onboarding, in settings, the profile menu and checkout. Guest and per-account choices are separate; account preferences use the existing revision/conflict/offline queue and preference WebSocket event. An older server receives no unsupported locale write. Browser detection is used when no explicit preference exists; explicit choices survive reload, sign-out and account switches. Regional dictionaries and matching are separate for Chinese scripts, Portuguese regions and Spanish regions.

Arabic and Urdu set document `lang`/`dir`. Logical CSS, directional menu placement/keys, wrapping controls, native system font fallbacks and natural direction on user text support RTL. Images, video, shared screens and physical coordinates keep their orientation. Rich React slots preserve links, events, icons and user values. Locale changes do not remount the application engine, socket, call media or hosted payment controls.

Central `Intl` helpers handle numbers, currency display, file size, durations, units, dates and relative time. ICU messages supply plural grammar, including Arabic and Slavic categories. Time zones, stored timestamps, currency values, quoted prices and entitlement calculations are unchanged. Search-filter examples and Markdown syntax are fixed code data rather than translated commands. The no-JavaScript fallback is English because the static page cannot read a stored locale without JavaScript.

## Locale coverage and review

| Locale | Native name | Translated / required | Coverage | Human review |
| --- | --- | ---: | ---: | --- |
| en | English | 6179 / 6179 | 100% | Source |
| bn | বাংলা | 6179 / 6179 | 100% | Pending |
| hi | हिन्दी | 6179 / 6179 | 100% | Pending |
| ur | اردو | 6179 / 6179 | 100% | Pending |
| zh-CN | 简体中文 | 6179 / 6179 | 100% | Pending |
| zh-TW | 繁體中文 | 6179 / 6179 | 100% | Pending |
| ja | 日本語 | 6179 / 6179 | 100% | Pending |
| ko | 한국어 | 6179 / 6179 | 100% | Pending |
| id | Bahasa Indonesia | 6179 / 6179 | 100% | Pending |
| vi | Tiếng Việt | 6179 / 6179 | 100% | Pending |
| th | ไทย | 6179 / 6179 | 100% | Pending |
| ar | العربية | 6179 / 6179 | 100% | Pending |
| tr | Türkçe | 6179 / 6179 | 100% | Pending |
| pt-BR | Português (Brasil) | 6179 / 6179 | 100% | Pending |
| es-419 | Español (Latinoamérica) | 6179 / 6179 | 100% | Pending |
| es-ES | Español (España) | 6179 / 6179 | 100% | Pending |
| fr | Français | 6179 / 6179 | 100% | Pending |
| de | Deutsch | 6179 / 6179 | 100% | Pending |
| it | Italiano | 6179 / 6179 | 100% | Pending |
| nl | Nederlands | 6179 / 6179 | 100% | Pending |
| pl | Polski | 6179 / 6179 | 100% | Pending |
| ru | Русский | 6179 / 6179 | 100% | Pending |
| uk | Українська | 6179 / 6179 | 100% | Pending |
| ro | Română | 6179 / 6179 | 100% | Pending |
| sv | Svenska | 6179 / 6179 | 100% | Pending |
| cs | Čeština | 6179 / 6179 | 100% | Pending |
| el | Ελληνικά | 6179 / 6179 | 100% | Pending |
| pt-PT | Português (Portugal) | 6179 / 6179 | 100% | Pending |

All 27 non-English locales are **awaiting professional native-speaker review**; no native approval is claimed. Catalogs contain translated text rather than empty or English-filled placeholders. Technical names and genuine native homographs/loanwords are intentionally shared and documented. Offline authoring and engineering review tools were temporary files outside the repository; only static dictionaries ship. Translation completeness and automated correctness do not establish professional linguistic approval. See [review.json](../../locales/review.json) and [coverage.json](coverage.json).

## Compatibility and verification

The backend change adds an optional validated personal `locale` value to the existing preference document. Supported values are the 28 locale codes, `system`, and null. Older clients can omit it without erasing it. There is **no database migration, replacement, endpoint change, token change or routing change**. Production retains the current PostgreSQL authority and existing environment, mounts, ports, storage, LiveKit, WebSocket and payment configuration. Only three compiled preference modules are overlaid onto the exact live API image. The API source PR and its full CI are recorded in [validation.json](validation.json).

An original strict preference reader can reject documents that now contain `locale`. Both publication and paired rollback therefore include a compatible reader that accepts/preserves locale-bearing documents while withholding the new capability from responses. Never roll back this release to the original strict reader. No preference cleanup or destructive database operation is required.

- Strict localization gate: **passed**, 6179 / 6179 keys in all 28 locales; no structural, missing, untranslated, hardcoded-render or icon-label findings.
- Repository typecheck, lint and formatting: **passed**.
- Unit suite: **967 passed, 1 existing conditional skip, 141 files**.
- Browser regression: **66 passed** on desktop and phone; the **14 localization cases were rerun after the final dictionary corrections and passed**.
- Optional preference tests: **17 SQLite, 17 PostgreSQL**; compatible rollback reader: **17 PostgreSQL**; existing PostgreSQL compatibility: **124 passed**.
- [Backend CI](https://github.com/nahianahmed3832/meldiq/actions/runs/41708332732): **passed** (server typecheck/tests/build plus the unchanged Android CI targets; no Android source change or distribution).
- Normal production build: **required and rerun by the release packager before publication**.

The browser suite uses Chromium desktop and a phone-width viewport. It covers all configured locale choices, the eight required script/layout samples, guest reload, account synchronization/isolation, unchanged user content, keyboard/focus behavior, stable sockets, active encrypted call tracks/audio, registration/recovery, media upload/download/original bytes, checkout regression, unchanged hosted card inputs during language switching, public invitations, and synchronous provider-return relay. Payment tests use existing mocks/test wiring; they do not prove real buyer approval, capture, signed-webhook or recurring lifecycle behavior. Existing production Plus offer flags remain unchanged. No new Android distribution or physical-device OAuth claim is made. Full Safari/Firefox regression and professional linguistic review remain outside the verified results.

## Performance and files

English remains the eager fallback; only the selected locale's application chunks are requested, with cached catalogs and formatters. Standalone pages request one small selected-locale subset and reuse it when revisited. The worker receives only its eight required labels and does not import the framework or full dictionaries. The predecessor worker is 201,859 bytes (62,984 gzip); the final normal-build measurement is recorded in the publication receipt. Source JSON sizes in [architecture.json](architecture.json) are informational and are not browser transfer or startup-latency benchmarks. No full startup or end-to-end latency benchmark is claimed.

[changed-files.json](changed-files.json) lists created/modified/deleted files in the isolated release checkout, avoiding unrelated work in the shared dirty workspace. [source-inventory.json](source-inventory.json) records the final source scan; the initial inventory is retained as historical evidence. [integration.json](integration.json) summarizes the current audited modules.

## Reproduce and publish

```bash
npm ci
npm run i18n:check
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

Run the browser suite against an isolated backend with the locale preference support, local LiveKit and the existing native test bot:

```bash
ORBIT_SERVER_DIR=/path/to/api/server \
ORBIT_GRIIP_BOT_DIR=/path/to/tools/griip-bot \
ORBIT_E2E_BUILD=1 \
  npx playwright test --config playwright.localization.config.ts
```

That browser artifact enables test device linking. **Never deploy it.** The dedicated packager builds a fresh normal artifact with `NEXT_PUBLIC_MELDIQ_TEST_LINKING=0`, requires committed clean sources, complete strict catalogs, successful selected browser tests and PostgreSQL preference tests, and records hashes/source commits in `RELEASE.json`.

```bash
node deploy/localization/package.mjs \
  /private/release-directory /private/current-production.json \
  /path/to/committed/api/server /path/to/compatible-reader/server
```

Read the current deployment controller, image ID, three preference-module hashes, live web predecessor and both release locks immediately before publishing. Transfer the resulting bundle to the server and invoke its `publish.py` with the absolute bundle directory. It obtains both existing release locks, verifies the exact predecessor, builds full and reader overlays before switching, copies the server-owned web configuration, retains loaded hashed assets, performs the paired API/web update and verifies served asset hashes, health, runtime configuration and other containers. It automatically falls back to the old web plus compatible reader if verification fails. The bundle's `rollback.py` performs a later guarded paired rollback; retain its manifest and images. Use these dedicated scripts for this release, since generic historical scripts do not retain the standalone hashed locale assets.

Publication has not yet occurred in this report snapshot. The final publication receipt records the deployed source, build ID and verification results.
