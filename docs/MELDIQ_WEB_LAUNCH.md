# Meldiq Web launch screen (2026-10-22)

## The asset

The owner's file is `~/Desktop/video_file/ads_video/griipbuddy_branding/meldiq_animation.mp4`, left unchanged (SHA-256
begins `cf0fea9d842eff16`). Measured with ffprobe:

| | Original | Shipped (`public/launch/`) |
|---|---|---|
| Codec | HEVC (H.265) Main | H.264 Main, level 3.1, faststart |
| Size | 2880 × 2880 | 480 × 480 (a 320 CSS px logo at 1.5×; sharp on phones) |
| Length | 5.0 s, 30 fps, no audio | the same |
| Bit rate / file | 72 Mbit/s, **45 MB** | **60 KB** |
| Plays in | Safari only (HEVC isn't playable in Chrome or Firefox) | every browser, Safari 16 included |
| Still | — | `meldiq-launch.jpg`, its first frame, 11 KB |

The animation is the Meldiq "M" on navy (`#0a132d`) with a light sweeping across it; its first and last frames are the
same, so the still and the end match.

## How it behaves

1. `index.html` shows the still on `#0a132d` from the first paint, before any script runs, centred at
   `min(62vmin, 320px)`.
2. The video plays over it only when `prefers-reduced-motion: no-preference` (a `<source media>`). With reduced motion
   nothing is downloaded and the still stays.
3. Data Saver and 2G remove the video. A video that can't play (unsupported, blocked, Low Power Mode, out of memory)
   leaves the still.
4. The screen fades out (260 ms) as soon as the app shows anything: sign-in, the app, an unsupported-browser or an
   error screen (`src/application/splash.ts`, called from `App.tsx` and `main.tsx`). Nothing waits for the 5 seconds.
5. It never stays over sign-in, errors or recovery, and it goes after 10 s at the latest.
6. It shows only on a full page load. Moving around the app never shows it again; loading inside the app uses the
   existing skeletons.

## Checked

`e2e/launch.spec.ts` in Chromium, WebKit and at phone width, on the development and production builds:
- the still shows at once and is gone at sign-in;
- reduced motion downloads no video;
- a failed download still opens Meldiq.

Not checked here: an iPhone 8 or any physical phone (`MELDIQ_WEB_BROWSERS.md` §5, step 1).
