import { useCallback, useEffect, useRef, useState } from "react";
import { createEngine, holdDeviceLock, missingCapabilities } from "../app/boot";
import { EngineProvider } from "../app/orbit";
import { resetPrefs } from "../app/prefs";
import type { SessionGrant } from "../api/schemas";
import type { DeviceRecord } from "../model/types";
import { LocalStore } from "../store/db";
import type { Engine } from "../sync/engine";
import { LinkScreen } from "./LinkScreen";
import { Shell } from "./shell/Shell";
import { ElsewhereScreen, LoadingScreen, RevokedScreen, UnsupportedScreen } from "./StatusScreens";

type Boot =
  | { s: "loading" }
  | { s: "unsupported"; missing: string[] }
  | { s: "elsewhere" }
  | { s: "signedOut"; store: LocalStore }
  | { s: "ready"; engine: Engine }
  | { s: "revoked"; reason: string | null }
  | { s: "error"; message: string };

/**
 * Boot: capability check, one tab per browser, then this browser's device record. No record: link to an account.
 * A record: sign in with the device key and start syncing (local data shows at once, even offline).
 */
export function App() {
  const [boot, setBoot] = useState<Boot>({ s: "loading" });

  const begin = useCallback(async (steal = false) => {
    setBoot({ s: "loading" });
    try {
      const missing = await missingCapabilities();
      if (missing.length) return setBoot({ s: "unsupported", missing });
      let engineRef: Engine | null = null;
      const held = await holdDeviceLock(steal, () => {
        engineRef?.stop();
        setBoot({ s: "elsewhere" });
      });
      if (!held) return setBoot({ s: "elsewhere" });
      const store = await LocalStore.open();
      const device = await store.device();
      if (!device) return setBoot({ s: "signedOut", store });
      const engine = createEngine(device, store);
      engineRef = engine;
      setBoot({ s: "ready", engine });
      await engine.start();
    } catch (e) {
      setBoot({ s: "error", message: e instanceof Error ? e.message : "Orbit couldn't start." });
    }
  }, []);

  // Once per page: React's development mode runs effects twice, and two boots would start two engines.
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void begin();
  }, [begin]);

  // A browser removed from the account (from the phone) erases what it kept, then says so.
  useEffect(() => {
    if (boot.s !== "ready") return;
    const engine = boot.engine;
    return engine.state.subscribe(() => {
      const st = engine.state.get();
      if (st.phase !== "revoked") return;
      engine.stop();
      void LocalStore.erase(engine.store).finally(() => setBoot({ s: "revoked", reason: st.phaseReason }));
    });
  }, [boot]);

  const linked = useCallback(async (store: LocalStore, device: DeviceRecord, grant: SessionGrant) => {
    await store.saveDevice(device);
    const engine = createEngine(device, store);
    setBoot({ s: "ready", engine });
    await engine.start(grant);
  }, []);

  const signedOut = useCallback(async () => {
    resetPrefs();
    setBoot({ s: "signedOut", store: await LocalStore.open() });
  }, []);

  switch (boot.s) {
    case "loading":
      return <LoadingScreen />;
    case "unsupported":
      return <UnsupportedScreen missing={boot.missing} />;
    case "elsewhere":
      return <ElsewhereScreen onUseHere={() => void begin(true)} />;
    case "revoked":
      return <RevokedScreen reason={boot.reason} onLinkAgain={() => void begin()} />;
    case "error":
      return <RevokedScreen reason={null} message={boot.message} onLinkAgain={() => void begin()} />;
    case "signedOut":
      return <LinkScreen onLinked={(d, g) => void linked(boot.store, d, g)} />;
    case "ready":
      return (
        <EngineProvider engine={boot.engine}>
          <Shell onSignedOut={() => void signedOut()} />
        </EngineProvider>
      );
  }
}
