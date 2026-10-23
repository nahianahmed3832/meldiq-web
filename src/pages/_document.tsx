import { Head, Html, Main, NextScript } from "next/document";

/**
 * The page every route is served from (a static export, docs/MELDIQ_WEB_NEXTJS.md). Rendered once, at build time, with
 * no data: the launch screen (docs/MELDIQ_WEB_LAUNCH.md) is plain markup so it shows before any script runs, and goes
 * as soon as the app shows something (src/application/splash.ts). Never hydrated, so the app can remove it.
 */
const SPLASH = [
  '<img src="/launch/meldiq-launch.jpg" alt="" width="480" height="480" decoding="async">',
  // As markup, not JSX: React leaves `muted` out of server-rendered HTML, and a video autoplays only when muted.
  '<video muted autoplay playsinline preload="auto" poster="/launch/meldiq-launch.jpg" disablepictureinpicture disableremoteplayback>',
  '<source src="/launch/meldiq-launch.mp4" type="video/mp4" media="(prefers-reduced-motion: no-preference)">',
  "</video>",
].join("");

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="theme-color" content="#1e1f22" />
        <meta name="referrer" content="no-referrer" />
        <meta name="application-name" content="Meldiq" />
        <meta name="apple-mobile-web-app-title" content="Meldiq" />
        <meta name="description" content="Meldiq Web: end-to-end encrypted team messaging, linked to your Meldiq account." />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Meldiq" />
        <meta property="og:title" content="Meldiq" />
        <meta property="og:description" content="End-to-end encrypted team messaging. Your workspace, on every screen." />
        <meta property="og:image" content="/meldiq-og.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/meldiq-192.png" />
        <link rel="apple-touch-icon" href="/meldiq-180.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
      </Head>
      <body>
        <noscript>Meldiq needs JavaScript: it encrypts and decrypts your messages in this browser.</noscript>
        <div id="splash" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SPLASH }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
