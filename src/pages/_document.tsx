import { Head, Html, Main, NextScript } from "next/document";

/**
 * The page every route is served from (a static export, docs/MELDIQ_WEB_NEXTJS.md). Rendered once, at build time, with
 * no data: the launch screen (docs/MELDIQ_WEB_LAUNCH.md) is plain markup so it shows before any script runs, and goes
 * as soon as the app shows something (src/application/splash.ts): the Meldling logo on its own teal, or for a browser
 * signed in here last time, the app's frame with skeletons. Never hydrated, so the app can remove it.
 */
const LAUNCH = '<img src="/launch/meldling-launch.png" alt="" width="480" height="480" decoding="async">';

/**
 * The app's frame as it opens again (2026-10-29): what a browser signed in here last time shows instead of Meldling
 * (public/boot.js decides before the first paint), in the app's own layout classes, so the first paint is the app with
 * skeletons where its lists and messages go, and the real frame replaces it without a jump. No data: nothing is known yet.
 */
const bar = (w: number) => `<span class="skeleton" style="height:12px;width:${w}%"></span>`;
const row = (w: number) => `<div class="boot-row"><span class="skeleton" style="width:22px;height:22px;border-radius:6px"></span>${bar(w)}</div>`;
const line = (w: number) => `<div class="boot-line"><span class="skeleton" style="width:38px;height:38px;border-radius:50%"></span><div>${bar(30)}${bar(w)}</div></div>`;
const FRAME =
  '<div class="app boot-frame">' +
  '<div class="brandbar"><img src="/meldling-96.webp" width="18" height="18" alt=""><span>Meldiq</span></div>' +
  '<nav class="rail"><img class="rail-mascot" src="/meldling-96.webp" width="46" height="46" alt=""></nav>' +
  '<div class="workspace with-sidebar"><header class="topbar"></header><div class="body phone-list">' +
  `<aside class="sidebar"><div class="side-scroll">${[62, 48, 70, 55, 66, 44, 58].map(row).join("")}</div></aside>` +
  `<section class="main"><div class="boot-messages">${[45, 70, 55].map(line).join("")}</div></section>` +
  "</div></div></div>";
const SPLASH = LAUNCH + FRAME;

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="theme-color" content="#1e1f22" />
        <meta name="referrer" content="no-referrer" />
        <meta name="application-name" content="Meldiq" />
        <meta name="apple-mobile-web-app-title" content="Meldiq" />
        {/* Added to the Home Screen (Safari › Share), Meldiq opens as an app: no Safari toolbar, and the page runs under
            a transparent status bar, kept clear by the safe-area padding of the app's frame and the landing page.
            iOS 16.4+ also reads display: standalone from the manifest; the meta covers older iOS. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="description" content="Meldiq Web: communities, messages, voice and video. Connect. Play. Belong." />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Meldiq" />
        <meta property="og:title" content="Meldiq" />
        <meta property="og:description" content="Communities, messages, voice and video. Connect. Play. Belong." />
        <meta property="og:image" content="/meldiq-og.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        {/* The tab icon is Meldling's silhouette alone (continuation brief v3 §6): teal on light browser chrome, white on
            dark. The square icon stays for home-screen and app icons (apple-touch-icon, the manifest). */}
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-light-32.png" media="(prefers-color-scheme: light)" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-dark-32.png" media="(prefers-color-scheme: dark)" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-light-16.png" media="(prefers-color-scheme: light)" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-dark-16.png" media="(prefers-color-scheme: dark)" />
        <link rel="icon" type="image/png" sizes="192x192" href="/favicon-light-192.png" media="(prefers-color-scheme: light)" />
        <link rel="icon" type="image/png" sizes="192x192" href="/favicon-dark-192.png" media="(prefers-color-scheme: dark)" />
        {/* Full-bleed and opaque: iOS rounds the corners itself and would fill transparent ones with black. */}
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        {/* Before the first paint: the last look, and the app's frame rather than the launch screen for a returning
            browser (public/boot.js; a file, as the Content-Security-Policy allows no inline script). */}
        <script src="/boot.js" />
      </Head>
      <body>
        <noscript>Meldiq needs JavaScript to run in this browser.</noscript>
        <div id="splash" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SPLASH }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
