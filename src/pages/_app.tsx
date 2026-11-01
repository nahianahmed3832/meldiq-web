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
import "../styles/billing.css";
import "../styles/settings-profile.css";
import "../styles/settings-parity.css";
import "../styles/settings-parity-b.css";
import "../styles/posting.css";
import "../styles/community-parity-a.css";
import "../styles/motion.css";
import "../styles/splash.css";
import "../styles/lobby.css";
import "../styles/lobby-editor.css";
import "../styles/landing.css";
import "../styles/discovery.css";
import "../styles/official-bots.css";
import "../styles/responsive.css";
import "../styles/settings-redesign.css";
import "../styles/embers.css";
import "../styles/collection.css";
import "../styles/leaderboards.css";
import "../styles/identity-marks.css";
import "../styles/mobile.css"; // mobile interaction and visual-viewport refinements

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
