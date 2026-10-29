import type { AppProps } from "next/app";
import Head from "next/head";
import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/layout.css";
import "../styles/conversation.css";
import "../styles/views.css";
import "../styles/call.css";
import "../styles/community.css";
import "../styles/profile.css";
import "../styles/decorations.css";
import "../styles/settings.css";
import "../styles/mojo.css";
import "../styles/motion.css";
import "../styles/splash.css";
import "../styles/responsive.css"; // last: its media queries override the rest

export default function MeldiqApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />
        <title>Meldiq</title>
      </Head>
      <Component {...pageProps} />
    </>
  );
}
