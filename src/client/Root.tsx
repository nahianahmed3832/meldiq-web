import { capturePendingInvite } from "../application/pendingInvite";
import { StrictMode, useEffect, useState } from "react";
import { loadConfig } from "../application/config";
import { applyTheme, getPrefs } from "../application/prefs";
import { startRouting } from "../application/router";
import { hideSplash, startSplash } from "../application/splash";
import { followVisualViewport } from "../application/viewport";
import { installLegacyCurves } from "../crypto/legacyCurves";
import { App } from "../ui/App";
import { ConfigError } from "../ui/StatusScreens";

type Start = { s: "starting" } | { s: "ready" } | { s: "failed"; message: string };

/**
 * The app's start in the browser (formerly src/main.tsx): theme, viewport, launch screen and routing (old hash links
 * become paths; links within the app don't reload the page) at once; then, before anything
 * signs, the Ed25519/X25519 fallback where WebCrypto lacks them (Safari before 17, every iPhone 8), and the deployment's
 * config.json. Only then does the app itself render.
 */
export default function Root() {
  const [start, setStart] = useState<Start>({ s: "starting" });

  useEffect(() => {
    applyTheme(getPrefs());
    followVisualViewport();
    startSplash();
    // Before routing reads the address: an invitation link's code is kept for after signing in (pendingInvite.ts).
    capturePendingInvite();
    const stopRouting = startRouting();
    let alive = true;
    void (async () => {
      await installLegacyCurves().catch(() => []);
      await loadConfig();
    })().then(
      () => alive && setStart({ s: "ready" }),
      (e: unknown) => {
        // A deployment mistake (an unreadable config.json): say so rather than talking to the wrong server.
        if (!alive) return;
        setStart({ s: "failed", message: e instanceof Error ? e.message : "Meldiq Web isn't configured correctly." });
        hideSplash();
      },
    );
    return () => {
      alive = false;
      stopRouting();
    };
  }, []);

  if (start.s === "starting") return null;
  if (start.s === "failed") return <ConfigError message={start.message} />;
  return (
    <StrictMode>
      <div id="root">
        <App />
      </div>
    </StrictMode>
  );
}
