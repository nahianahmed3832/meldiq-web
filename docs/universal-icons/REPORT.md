Meldiq universal icon system — 5 November 2026 (Asia/Shanghai)

This release establishes a shared icon catalogue and a limited navigation/settings pilot. Remaining screens retain their existing behavior and migrate gradually. Live web input is the exact compact-rail release `1153ca0` plus receipt `0d3d7ab`; the older main branch and dirty primary workspace are not production build inputs.

1. Applications inspected

The detailed machine inventory is `inventory.json`. Source/build/icon audits cover the primary web, Android, Windows, administration console, landing website and status platform, plus available release/integration worktrees. These are multiple snapshots of six application surfaces, not six dozen independent products. `meldiq_ios` has no client source; `meldiq_bots` has no independent client UI. No separate iOS implementation can be claimed. Responsive mobile uses the same Next.js/React client. Windows is Electron with a locally bundled React snapshot in `packages/web`; it does not automatically receive hosted web updates. Native tray, menus, window controls and application logos retain platform conventions and existing assets.

Before this pilot, primary web had Lucide imports in 239 source files and eight files containing inline SVGs; Windows had 236 and eight. Android had Material Compose icon imports in 183 files, with outline/rounded substitutions and proprietary message artwork. Administration already uses Lucide (56 files); the landing website uses inline SVGs (six files). Legacy settings paths were duplicated in web and Windows, used a 1.65 stroke, and had no semantic cross-platform contract. Desktop activity used AtSign while web used Bell; Android selected filled/rounded forms independently. The pilot resolves those navigation/settings inconsistencies. Existing standalone SVGs in scanned source/public folders parsed successfully; this is not proof that every legacy inline path or brand asset is correct. Owned avatars, Ember artwork, rank medals and launcher assets are deliberately outside this interface-glyph pilot.

2. Sources and licensing

| Collection | Evaluation | Decision |
|---|---|---|
| [Lucide](https://lucide.dev/license) | 24-unit outline geometry, rounded caps/joins, already pinned in web/desktop. ISC with Feather-derived icons covered by MIT. | Selected; full combined upstream licence retained and shipped. |
| [Tabler](https://github.com/tabler/tabler-icons/blob/main/LICENSE) | MIT; compatible outline alternative but adds another visual vocabulary. | No pilot dependency. |
| [Phosphor](https://github.com/phosphor-icons/core/blob/main/LICENSE) | MIT; multiple weights and variants require additional parity decisions. | No pilot dependency. |
| [Material Symbols](https://developers.google.com/fonts/docs/material_symbols) | Apache 2.0; strong Android support, but filled/variable forms differ from the selected language. | Legacy Android retained outside pilot. |
| [Font Awesome Free](https://fontawesome.com/license/free) | SVG/JS icons CC BY 4.0, fonts SIL OFL 1.1, code MIT; attribution differs by asset type. | No pilot dependency. |
| [Iconify](https://iconify.design/docs/icons/icon-basics.html) | Aggregator; each collection has its own licence. A wrapper licence does not license its icons. | Discovery only; no runtime API or library introduced. |

All 33 selected SVGs were extracted from installed `lucide-react@1.59.0`, keeping exact upstream geometry. Every entry records collection, original name, version, upstream URL, SVG source, combined notice, dimensions, variants and all platform mappings. The sanitizer uses a primitive/attribute allowlist and rejects scripts, external resources, declarations, nested elements, unsafe attributes and nonnumeric geometry. SVGs are parsed at build time; React creates local primitives without injecting HTML. No new third-party brand asset is introduced. Existing authentication/payment logos remain outside the pilot; future brand migrations must use official owner downloads and record Google, Apple, Discord, PayPal or GitHub usage guidelines individually. Generic Lucide shapes must never impersonate brands.

3. Catalogue and adapters

Canonical source is the Meldiq Web repository's `shared/icons/catalogue.json` and `shared/icons/svg/`. It owns 33 unique semantic identifiers including navigation, communication, community, files, settings and presence. `scripts/icons/generate.py` generates:

- `src/ui/icons/Icon.tsx`: typed semantic names, standard sizes, decorative defaults, optional accessible label and disabled opacity. Static geometry includes only the bounded 33-icon subset; it does not import an entire collection or rely on dynamic remote lookup. The map retains the selected subset for semantic lookup; per-icon tree shaking is not claimed.
- `platforms/android/res/drawable/mi_*.xml` and `MeldiqIcon.kt`: the same geometry converted to Android vector paths. `--android` copies them into the single Android workspace. The handwritten Compose adapter uses local `painterResource`, inherited tint, standard dp sizes and optional content description.
- `shared/icons/manifest.json`: source/adapter digests for desktop drift detection. `--desktop` updates the bundled mirror and licence. Desktop's `icons:universal-check` verifies it independently in Windows candidate CI.
- `public/icon-licenses.txt`: full distributable notices, copied into desktop public assets and Android assets.

Tokens are 24×24 geometry, stroke 2, rounded caps/joins and sizes 16/18/20/24/32. Existing legacy settings sizes resolve to the nearest token. Parent controls own active/hover foreground, selection semantics, focus, keyboard behavior and disabled interaction; disabled glyph opacity is 0.38. Layout direction follows the locale; directional glyph mirroring requires review. Keep at least 44px web and 48dp Android hit areas. Parent labels remain accessible and glyphs remain decorative when adjacent to text. Themes use inherited foreground; existing product-specific membership accents remain.

4. Pilot and dependencies

Web migrates the settings-symbol compatibility component and Home/Activity sidebar plus primary mobile tabs through the shared navigation model. Desktop migrates the same settings symbols and Home/Messages/Activity phone-size navigation. Account avatars and existing routes/badges are preserved. Android migrates four bottom-navigation destinations through the Compose adapter while keeping selection, badges, TalkBack semantics and the existing 52dp minimum tab targets. Unknown nonpilot destinations retain their existing implementation.

No runtime or production build dependency was added. React and existing development tools are reused; Python standard library drives generation/validation. A temporary external virtual environment supplied PyYAML solely for the bundled skill validator; it is not an app dependency. The permanent `.agents/skills/meldiq-universal-icons/SKILL.md` is installed in the task workspace and affected client repositories. It requires semantic reuse, parity, licensing, catalogue updates, local assets, and prohibits emoji substitutions and arbitrary SVGs.

5. Checks and evidence

Catalogue generation/checks cover missing identifiers, duplicate identifiers/geometry, licence files, malformed/unsafe SVGs, missing Android/desktop mappings, size and stroke consistency, unknown literal React semantic uses, and generated-consumer drift. Fourteen deliberate corruption/conversion tests exercise the gate. React rendering tests cover every name, decorative/labelled accessibility, disabled state and absence of remote-backed SVG elements.

`evidence/offline-browser.json` records eight offline Chromium/WebKit matrices: 390/1440 widths × light/dark themes, 33 icons × five sizes in every matrix, zero requests/page errors, exact geometry and bounds checks. Screenshots are retained beside the receipt. The bounded adapter is 7,809 minified bytes / 2,543 gzip bytes in isolation with React external. This is an adapter measurement, not a whole-application startup benchmark. APK production size comparison is not claimed.

Local release validation passed: 971 web tests across 143 files (one skipped), typecheck, lint, formatting, 28-locale structure validation, production export, and six integrated Chromium desktop/phone and WebKit desktop browser scenarios. The initial parallel test run timed out in the localization quality test; the complete rerun with two workers passed. Android debug compilation/resources and the native-graphics bitmap test for all 33 vectors passed. Desktop local typecheck/lint, 109 tests, 1,722-file snapshot check and icon digest check passed. Skill validation passed. Windows CI and production receipts follow in the release evidence. Browser/backend doubles are not buyer, physical-device, native macOS/Linux or Play-distribution evidence.

6. Gradual migration and remaining work

Migrate by purpose: conversation composer/actions and file controls; community members/roles and moderation; account/settings remainder; administration, landing and status surfaces; then officially sourced third-party brands. Each step adds required semantic IDs before changing callers, regenerates every platform, and tests representative routes with badges, accessibility, small screens, light/dark, RTL and offline rendering. Avoid a blanket replacement of arbitrary library imports. Legacy Material dependencies remain until their final caller migrates; removing them now would break unrelated screens.

Android has substantial pre-existing local changes. Only this task's adapter/assets/test/skill and navigation patch are staged/pushed; compilation tests use the current consolidated workspace and are not proof of a clean production checkout. Play signing is currently manual and requires the owner's upload key; this task must not claim an unsigned build is published. Physical Android/Windows testing, complete migration and iOS source are separate remaining work. No backend or database change is needed for this release.
