# Meldiq Web launch screen

## The asset (2026-10-27)

Meldling, the owner's canonical mascot (`brand/meldling.png`: the off-white bear cub on a solid deep-teal square,
1254 × 1254, colours `#045349` and `#fdfcf9`). `scripts/render-brand-assets.mjs` scales the whole square to
`public/launch/meldling-launch.png` (480 × 480, 18 KB). Nothing is redrawn.

It replaced the Meldiq "M" ribbon animation of 2026-10-22 (a 60 KB H.264 video plus its first frame); the ribbon logo
is kept only as a reference, `brand/reference/meldiq-logo-ribbon.webp`.

## How it behaves

1. The page shows Meldling on `#045349` from the first paint, before any script runs, centred at `min(62vmin, 320px)`.
   The image's square is the page's colour, so it has no visible edge.
2. Where `prefers-reduced-motion: no-preference`, Meldling breathes (scale 1 → 1.04, 2.4 s). With reduced motion it is
   still. Nothing else is downloaded.
3. The screen fades out (260 ms) as soon as the app shows anything: sign-in, the app, an unsupported-browser or an
   error screen (`src/application/splash.ts`, called from `App.tsx` and `main.tsx`).
4. It never stays over sign-in, errors or recovery, and it goes after 10 s at the latest.
5. It shows only on a full page load. Moving around the app never shows it again; loading inside the app uses the
   existing skeletons.
6. A browser that was signed in here last time (2026-10-29: reloads and returns open like an app) shows the app's own
   frame instead: rail, sidebar and messages as skeletons, in the last theme and palette. `public/boot.js` picks it
   before the first paint from `meldiq.returning` and `meldiq.look` in localStorage (no messages, no keys); the
   frame's markup is in `src/pages/_document.tsx`. Signing out, or a removed browser, brings Meldling back.

## Checked

`e2e/launch.spec.ts`: Meldling shows at once and is gone at sign-in; with reduced motion it doesn't animate.

## The snapshot (2026-10-30)

The owner, 2026-10-30: "Yes, keep snapshot". Until then the browser kept only its sign-in on disk (2026-10-28), so
every reload drew skeletons until the server answered. Now it also keeps one snapshot of the app for the account
signed in here (`src/sync/snapshot.ts`), as Yapin' and Discord do, and draws from it before the network answers:

- **What:** conversations and channel lists, the communities' categories, the people shown (names, avatars, looks),
  unread and mention counts, the navigation layout, and the newest 50 messages of the 12 conversations opened most
  recently. The last place stays in `localStorage` (`src/application/lastPlace.ts`), as before.
- **When:** about 4 s after changes settle, and at once when the tab is hidden or closed; only after the server has
  answered once, and never while the session asks for the password.
- **How:** sealed with AES-GCM under a key this browser makes for it (non-extractable, in IndexedDB beside it, as the
  account tokens' key), bound to the account and the snapshot's version. At most 5 MB; past that, or when storage is
  full, the oldest conversations' messages go first.
- **Erased:** with the whole database on signing out, a removed browser or a deleted account; and dropped quietly when
  it belongs to another account, is of another version, or can't be decrypted or read.
- **Locked:** a session that can't renew itself (no tokens, or its refresh token ran out) draws nothing from it.
