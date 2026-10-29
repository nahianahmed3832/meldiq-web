# Meldiq on iPhone: Add to Home Screen (2026-10-30)

Meldiq Web installs on iPhone and iPad from Safari: **Share › Add to Home Screen**. Opened from the Home Screen it runs
as an app, without Safari's toolbar. There's no separate iOS app and no new dependency: the existing manifest, service
worker and safe-area layout already did most of it; this round adds the iOS tags and a proper icon.

## What's in place

| Piece | Where | Notes |
|---|---|---|
| Manifest | `public/manifest.webmanifest` | `name`/`short_name` Meldiq, `id`/`start_url`/`scope` `/`, `display: standalone`, theme and background the brand teal `#045349`, icons 192, 512 and maskable 512 from the official Meldling logo |
| iOS tags | `src/pages/_document.tsx` | `apple-mobile-web-app-capable` (iOS before 16.4; later versions also read the manifest), `mobile-web-app-capable`, `apple-mobile-web-app-title` Meldiq, `apple-mobile-web-app-status-bar-style: black-translucent` |
| Home Screen icon | `public/apple-touch-icon.png` (180×180) | **New.** The same crop of `brand/meldling.png` as the other icons, full-bleed and opaque: the previous `meldling-180.png` had transparent rounded corners, which iOS fills with black. Made by `scripts/render-brand-assets.mjs` |
| Safe areas | `src/styles/layout.css`, `responsive.css`, `call.css`, `landing.css` | `viewport-fit=cover`; the app's frame, the phone tab bar, call controls and now the landing page pad for the notch, the status bar and the home indicator |
| Install help | `src/application/install.ts`, Settings › About | Chromium offers "Install Meldiq"; on iPhone, Settings explains Share › Add to Home Screen; nothing shows once installed |
| Service worker | `src/sw/sw.ts`, `src/sw/shell.ts` | Caches **only** the app's page, its content-hashed build files and `/boot.js`. Never the API, `config.json`, media, messages or tokens. Sign-in tokens stay in the page's IndexedDB as before |

The service worker wasn't changed. Messages, authentication and the API are untouched.

## Notifications on iPhone

Web Push is built (docs/MELDIQ_WEB_PUSH.md): the service worker, registration in Settings › Notifications, the server's
content-free wake-ups through Firebase, and the app's own notification rules. iOS delivers Web Push **only to a Home
Screen app** (iOS 16.4+), and Settings already says so in Safari.

It is **off in production** because the Firebase web app was never configured. To turn it on (owner):

1. Firebase console › project `meldiq` › add a Web app; copy `apiKey`, `projectId`, `messagingSenderId`, `appId`.
2. Cloud Messaging › Web Push certificates › generate a key pair; copy the public `vapidKey`.
3. Put the five values in `/root/meldiq-web-firebase.json` on the VPS (none is a secret).
4. Install the next web release with `MELDIQ_FIREBASE_CONFIG=/root/meldiq-web-firebase.json` added to the usual
   command. No server change is needed.
5. Test on a real iPhone: add to Home Screen, open it, Settings › Notifications › When Meldiq is closed › Turn on.

Not built: notification text (messages are end-to-end encrypted, so wake-ups say "2 new messages"), and answering a
call from the notification.

## Checked

- Unit tests (94 files) and browser tests in Chromium, WebKit and at phone width: the landing page, sign-up and sign-in,
  languages, Mojo, the launch screen. `e2e/landing.spec.ts` checks the iOS tags, the manifest
  (`standalone`, start URL, scope) and that every icon URL answers a PNG.
- The landing page at 375, 768 and 1440 px wide: no sideways scrolling.

## Limits

- **Not tested on a real iPhone.** WebKit in Playwright doesn't run Home Screen mode, so check once on a phone: add to
  Home Screen, open, sign in, open a conversation and go back, start a call.
- iOS shows a plain screen while the app starts (no `apple-touch-startup-image` set per device size); the app's own
  Meldling launch screen follows within a moment.
- Home Screen apps have no back gesture or back button from Safari: navigation is the app's own (the phone tab bar and
  the back buttons in its headers).
- Links to other sites (Stripe checkout, the legal pages) open in an in-app Safari sheet with a Done button.
- Storage: iOS may clear a Home Screen app's data after weeks of not opening it; signing in again restores the account
  (the browser's encryption keys come back from the key backup or the recovery key).
