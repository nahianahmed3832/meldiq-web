import { useCallback, useEffect, useRef, useState } from "react";
import { createEngine, holdDeviceLock, missingCapabilities } from "../app/boot";
import { EngineProvider } from "../app/orbit";
import { resetPrefs } from "../app/prefs";
import type { AccountSessionGrant } from "../api/accountSchemas";
import type { SessionGrant } from "../api/schemas";
import { tokensOf } from "../auth/accountSession";
import { TokenVault } from "../auth/tokenVault";
import type { DeviceRecord } from "../model/types";
import { LocalStore } from "../store/db";
import { signOut } from "../sync/account";
import type { Engine } from "../sync/engine";
import { AuthScreen } from "./auth/AuthScreen";
import { ReauthScreen } from "./auth/ReauthScreen";
import { LinkScreen } from "./LinkScreen";
import { Shell } from "./shell/Shell";
import { ElsewhereScreen, LoadingScreen, RevokedScreen, UnsupportedScreen } from "./StatusScreens";

type Boot =
  | { s: "loading" }
  | { s: "unsupported"; missing: string[] }
  | { s: "elsewhere" }
  | { s: "signedOut"; store: LocalStore }
  /** Linking with the phone alone (no Orbit 2.0 account), while the server still allows device-key sign-in. */
  | { s: "phoneLink"; store: LocalStore }
  | { s: "ready"; engine: Engine; reauth: boolean }
  | { s: "revoked"; reason: string | null }
  | { s: "error"; message: string };

/**
 * Boot: capability check, one tab per browser, then this browser's device record. No record: sign in (Orbit 2.0 account)
 * or link with the phone. A record: renew the session (account) or sign in with the device key (linked before 2.0), and
 * start syncing (local data shows at once, even offline).
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
      setBoot({ s: "ready", engine, reauth: false });
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

  // A browser removed from the account (from the phone) erases what it kept, then says so. An ended account session asks
  // for the password again.
  const engine = boot.s === "ready" ? boot.engine : null;
  useEffect(() => {
    if (!engine) return;
    return engine.state.subscribe(() => {
      const st = engine.state.get();
      if (st.phase === "revoked") {
        engine.stop();
        void LocalStore.erase(engine.store).finally(() => setBoot({ s: "revoked", reason: st.phaseReason }));
        return;
      }
      const reauth = st.phase === "reauth";
      setBoot((b) => (b.s === "ready" && b.engine === engine && b.reauth !== reauth ? { ...b, reauth } : b));
    });
  }, [engine]);

  const linked = useCallback(async (store: LocalStore, device: DeviceRecord, grant: SessionGrant | AccountSessionGrant) => {
    await store.saveDevice(device);
    const engine = createEngine(device, store);
    setBoot({ s: "ready", engine, reauth: false });
    await engine.start(grant);
  }, []);

  const saveAccountDevice = useCallback(async (store: LocalStore, device: DeviceRecord, grant: AccountSessionGrant) => {
    await store.saveDevice(device);
    await new TokenVault(store).save(tokensOf(grant));
  }, []);

  const signedOut = useCallback(async () => {
    resetPrefs();
    setBoot({ s: "signedOut", store: await LocalStore.open() });
  }, []);

  /** From "Sign in again": erases this browser without a session (it can't remove itself from the account first). */
  const eraseAndSignOut = useCallback(
    async (engine: Engine) => {
      await signOut(engine, true).catch(() => LocalStore.erase(engine.store));
      await signedOut();
    },
    [signedOut],
  );

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
      return (
        <AuthScreen onSave={(d, g) => saveAccountDevice(boot.store, d, g)} onReady={(d, g) => void linked(boot.store, d, g)} onLinkWithPhone={() => setBoot({ s: "phoneLink", store: boot.store })} />
      );
    case "phoneLink":
      return <LinkScreen onLinked={(d, g) => void linked(boot.store, d, g)} onBack={() => setBoot({ s: "signedOut", store: boot.store })} />;
    case "ready":
      if (boot.reauth) return <ReauthScreen engine={boot.engine} onSignOut={() => void eraseAndSignOut(boot.engine)} />;
      return (
        <EngineProvider engine={boot.engine}>
          <Shell onSignedOut={() => void signedOut()} />
        </EngineProvider>
      );
  }
}
