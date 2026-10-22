# Meldiq Web on phones and older browsers (2026-10-22)

Why Meldiq Web didn't work on an iPhone 8, what was fixed, which browsers are supported, and the checklist for testing on a
real device. Owner of the device tests: the product owner (no physical iPhone was available to the engineering session).

## 1. Why it failed on an iPhone 8

An iPhone 8 can't go past **iOS 16.7** (Safari 16.6). Meldiq Web needed three things Safari only got in iOS 17 and 17.5.
Sources: MDN browser-compat-data 6.0.10 and the code.

| Needed | Safari / iOS | What happened on iOS 16 |
|---|---|---|
| WebCrypto **Ed25519** (signing in, signing every message) | 17.0 | `missingCapabilities()` (src/app/boot.ts) stopped at "This browser is missing … Ed25519 signatures", before sign-in |
| WebCrypto **X25519** (opening messages, HPKE) | 17.0 | The same screen ("X25519 key agreement") |
| CSS **light-dark()** (every colour) | 17.5 | The same screen ("light and dark colours"); without the check, most colours would be unset |

Newer iPhones on iOS 17.5+ had all three, which matches the report ("works on a newer iPhone, not on an iPhone 8").
Nothing else in the app or its dependencies needs more than Safari 16.4. The checks:
- JavaScript syntax: the build target is pinned to Safari 16.4 and esbuild lowers or refuses anything newer.
- Runtime APIs: the shipped bundles were searched; only `structuredClone` and `.at()` (15.4) appear.
- Every optional API (folders, file pickers, screen sharing, notifications, locks, `ResizeObserver`) is detected first.

### Fixes

| Fix | Where | Effect |
|---|---|---|
| Fallback Ed25519/X25519 | `src/crypto/legacyCurves.ts` (@noble/curves 1.9.7, audited) | Installed into `crypto.subtle` only where the browser lacks them, before anything signs (page and service worker). Same algorithms and bytes on the wire |
| Sealed signing key | `keyStorage.ts`, `identity.ts`, `store/db.ts` | Where the fallback is used, both private keys are stored only sealed with a non-extractable AES-GCM key, as WebKit's X25519 key already was |
| Colour fallback | `build/lightDarkFallback.ts` (build step) | Every `light-dark()` token again for browsers without it: light, the system's dark mode, Meldiq's dark setting, every palette |
| Build target | `vite.config.ts`, `vite.sw.config.ts` | `es2022` + `safari16.4` |

**The one difference on old browsers (owner's awareness):**
- Where the fallback runs, the private keys are held in the page's memory rather than inside the browser's crypto engine.
- At rest they're sealed, as before.
- A script injected into the page could read them there; on browsers with native support it could only use them. The
  CSP (`script-src 'self'`, no inline scripts) is the defence, as everywhere.
- Browsers with native Ed25519/X25519, i.e. every current one, keep non-extractable keys exactly as before.

## 2. Support policy

| Target | Supported | Notes |
|---|---|---|
| **iPhone 8 on iOS 16.4–16.7** (Safari 16.4+) | Yes, the oldest supported | Through the fallbacks above; background notifications only with Meldiq added to the Home Screen |
| iOS 15.x and Safari < 16.4 | No | Parsing the app needs Safari 16.4 (regex lookbehind in message text, class static blocks in dependencies). The page shows the browser's own error; an iPhone 8 can update to 16.7 for free |
| Newer iPhones (iOS 17, 18, current) | Yes | Native Ed25519/X25519 |
| iPad (portrait, landscape) | Yes | Same as iPhone; iPadOS reports itself as a Mac |
| Android Chrome (current) | Yes | |
| Desktop Chrome, Edge, Firefox, Safari (current) | Yes | |

## 3. Phones: what else changed (2026-10-22)

| Problem | Cause | Fix |
|---|---|---|
| The page zooms in when typing | iOS Safari zooms into any field under 16px when it's focused (fields and the composer were 14–15px) | Fields are 16px on touch screens; controls use `touch-action: manipulation` (no double-tap zoom). Pinch zoom is untouched |
| The keyboard covers the composer | iOS slides the page under its keyboard instead of resizing it | The frame follows the visual viewport (`src/app/viewport.ts`); Android Chrome resizes the page (`interactive-widget`) |
| A tap on a reaction didn't toggle it | The message toolbar appeared on `:hover`; iOS swallows the tap that reveals hover content | Hover reveals the toolbar only where there's hover; on touch screens a long press opens the message's menu (quick reactions, Add reaction, Reply, …). A scroll never opens it |
| A channel's name vanished on a 320px phone | Six header buttons | `# name ›` and search (batch B14b) |

Layout is checked at 320×568, 360×800, 375×812, 390×844, 430×932, 768×1024, 1024×768, 1280×800 and 1440×900
(`e2e/viewports.spec.ts`). Nothing scrolls sideways and the composer is on screen. That's layout in Chromium, not a
phone's browser.

## 4. Platform limits (not bugs)

- **Background notifications on iPhone/iPad:** iOS 16.4+ only, and only once Meldiq is added to the Home Screen
  (Share › Add to Home Screen) and opened from there. In Safari itself, notifications come only while Meldiq is open.
- **Screen sharing from a phone's browser:** neither iOS nor Android browsers offer it (no `getDisplayMedia`). Phones can
  watch someone else's share; the button isn't shown on them.
- **Low Power Mode (iOS):** videos don't autoplay, so the launch screen shows the still logo. Calls are unaffected.
- **Private Browsing (Safari):** storage is erased when the tab closes, so the browser must be linked again each time.

## 5. Device checklist (iPhone 8 and others)

Record each run in the table: model, iOS version (Settings › General › About), browser and version, date, result.

1. **Open** https://web.meldiq.app in Safari. *Expected:* the Meldiq logo, then sign-in (not "This browser is
   missing…"). Colours are right in light and in dark mode (Settings › Display).
2. **Sign in** with email and password, then unlock with the emailed code. *Expected:* the app opens; no zoom when
   tapping the fields.
3. **Messages:** open a DM, send one, receive one from another device. *Expected:* both show decrypted. While typing,
   the composer stays above the keyboard and the header stays visible.
4. **Reload** (pull down / reload button). *Expected:* signed in again without a code; history still readable.
5. **Reactions:** tap an existing reaction (it toggles); long-press a message (menu with quick reactions); scroll the
   list with a finger resting on a message (no menu).
6. **Channel:** open a community channel. *Expected:* `# name ›`; tap it for details (Members, Media, Pins, Threads,
   Links, Files).
7. **Call:** voice call to another device; then video. *Expected:* audio both ways, "End-to-end encrypted" badge.
8. **Background notifications** (iOS 16.4+): add to Home Screen, open from there, Settings › Notifications › turn on.
   Lock the phone, send a message from another account. *Expected:* a notification; tapping it opens that DM. (Needs the
   Firebase web app to be set up first: `MELDIQ_WEB_PUSH.md` §3.)
9. **Rotate** to landscape and back. *Expected:* nothing cut off; the composer stays usable.

| Device | iOS | Browser | Date | Steps passed | Notes |
|---|---|---|---|---|---|
| iPhone 8 | | Safari | | | |
| Newer iPhone | | Safari | | | |
| Android phone | | Chrome | | | |
| Desktop | | | | | |

## 6. How it was checked here (2026-10-22, no physical devices)

- `test/legacy-curves.test.ts`: the fallback against the shared Android/server vectors and node's native
  Ed25519/X25519 (both directions), and sealed keys surviving a reload.
- The **whole** unit and live suite with the fallback forced: `ORBIT_LEGACY_CURVES=1 npx vitest run`.
- `e2e/legacy-safari.spec.ts`, in Chromium and WebKit with native Ed25519/X25519 removed: links, sends, receives, and
  signs in again after a reload.
- `e2e/touch.spec.ts` (phone width), `e2e/launch.spec.ts`, `e2e/viewports.spec.ts`.
- The production build too (`ORBIT_E2E_BUILD=1`).
- **Not done:** Safari 16 itself (Playwright's WebKit is current), or any physical phone. Until the checklist above passes
  on an iPhone 8, treat iPhone 8 support as built and simulated, not verified.
