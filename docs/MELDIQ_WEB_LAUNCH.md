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

## Checked

`e2e/launch.spec.ts`: Meldling shows at once and is gone at sign-in; with reduced motion it doesn't animate.
