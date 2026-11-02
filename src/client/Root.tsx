import "../application/validationPolicy";
import { captureDiscordReturn } from "../application/discordReturn";
import { useRouter } from "next/router";
import { capturePendingInvite, capturePendingMessage, capturePendingTemplate, captureReferral } from "../application/pendingInvite";
import { StrictMode, useEffect, useState } from "react";
import { startConfig } from "../application/config";
import { applyTheme, getPrefs } from "../application/prefs";
import { startRouting } from "../application/router";
import { hideSplash, startSplash } from "../application/splash";
import { followVisualViewport } from "../application/viewport";
import { guardInspectorKeys } from "../application/inspectGuard";
import { installLegacyCurves } from "../crypto/legacyCurves";
import { App } from "../ui/App";
import { ConfigError } from "../ui/StatusScreens";

type Start = { s: "starting" } | { s: "ready" } | { s: "failed"; message: string };

/**
 * The app's start in the browser (formerly src/main.tsx): theme, viewport, launch screen and routing (old hash links
 * become paths; links within the app don't reload the page) at once; then, before anything
 * signs, the Ed25519/X25519 fallback where WebCrypto lacks them (Safari before 17, every iPhone 8), and the deployment's
 * config.json (the copy read last time, at once, after the first visit: application/config.ts startConfig). Only then
 * does the app itself render.
 */
export default function Root() {
  const router = useRouter();
  const [start, setStart] = useState<Start>({ s: "starting" });

  useEffect(() => {
    // Next may normalize its initial rewrite once. Start our path/hash router after that address is stable.
    if (!router.isReady) return;
    applyTheme(getPrefs());
    const stopViewport = followVisualViewport();
    guardInspectorKeys();
    startSplash();
    // Before routing reads the address: an invitation link's code is kept for after signing in (pendingInvite.ts).
    capturePendingInvite();
    captureReferral();
    capturePendingMessage();
    capturePendingTemplate();
    captureDiscordReturn();
    const stopRouting = startRouting();
    let alive = true;
    void (async () => {
      await Promise.all([installLegacyCurves().catch(() => []), startConfig()]);
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
      stopViewport();
    };
  }, [router.isReady]);

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
