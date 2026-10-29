import { Head, Html, Main, NextScript } from "next/document";

/**
 * The page every route is served from (a static export, docs/MELDIQ_WEB_NEXTJS.md). Rendered once, at build time, with
 * no data: the launch screen (docs/MELDIQ_WEB_LAUNCH.md) is plain markup so it shows before any script runs, and goes
 * as soon as the app shows something (src/application/splash.ts): the Meldling logo on its own teal. Never hydrated, so the app can remove it.
 */
const SPLASH = '<img src="/launch/meldling-launch.png" alt="" width="480" height="480" decoding="async">';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="theme-color" content="#1e1f22" />
        <meta name="referrer" content="no-referrer" />
        <meta name="application-name" content="Meldiq" />
        <meta name="apple-mobile-web-app-title" content="Meldiq" />
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
        <link rel="apple-touch-icon" href="/meldling-180.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
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
