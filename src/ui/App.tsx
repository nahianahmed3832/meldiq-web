import { accountStoreForBoot, accountDirectory, rememberAccount, forgetAccount, cancelAddingAccount, selectAccount, type AccountDirectory } from "../auth/savedAccounts";
import { AccountActionsProvider } from "./shell/AccountActions";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { createEngine, holdDeviceLock, missingCapabilities, startNotifications } from "../application/boot";
import { hideSplash, rememberReturning } from "../application/splash";
import { forgetReadingPositions } from "../application/readingPosition";
import { forgetPlace, placeToRestore } from "../application/lastPlace";
import { go } from "../application/router";
import { EngineProvider } from "../application/orbit";
import { resetPrefs } from "../application/prefs";
import { forgetRecentSearches } from "./dialogs/SearchDialog";
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
import { TEST_DEVICE_LINKING } from "../auth/testLinking";
import { watchInstall } from "../application/install";
import { ElsewhereScreen, LoadingScreen, RevokedScreen, UnsupportedScreen } from "./StatusScreens";
import { watchForUpdates } from "../application/updates";
import { UpdateNotice } from "./UpdateNotice";
import { voicePlayback } from "../application/voicePlayback";

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
// The pre-email phone link (auth/testLinking.ts): its own chunk, loaded only where the flag is on, never in a release.
const loadShell = () => import("./shell/Shell");
const Shell = lazy(() => loadShell().then((m) => ({ default: m.Shell })));

const LinkScreen = lazy(() => import("./LinkScreen").then((m) => ({ default: m.LinkScreen })));

// The browser may offer installing as soon as the page loads: listen before anything renders (brief v4 §17).
watchInstall();

/**
 * Opened at the bare address (a return, the installed app's start): the conversation or section left last. One that's
 * gone since closes after the first sync, as any link to it would (Shell).
 */
function reopenLastPlace(engine: Engine): void {
  const href = placeToRestore(engine.device.userId, location);
  if (href) go(href, true);
}

export function App() {
  const activeEngineRef = useRef<Engine | null>(null);
  const [directory, setDirectory] = useState<AccountDirectory | null>(null);
  const [boot, setBoot] = useState<Boot>({ s: "loading" });
  // The launch screen goes as soon as there's something to show: sign-in, the app, or what went wrong.
  useEffect(() => {
    if (boot.s !== "loading") hideSplash();
  }, [boot.s]);

  const begin = useCallback(async (steal = false) => {
    setBoot({ s: "loading" });
    try {
      const missing = await missingCapabilities();
      if (missing.length) return setBoot({ s: "unsupported", missing });
      const held = await holdDeviceLock(steal, () => {
        activeEngineRef.current?.stop();
        setBoot({ s: "elsewhere" });
      });
      if (!held) return setBoot({ s: "elsewhere" });
      const { store, directory: saved } = await accountStoreForBoot();
      setDirectory(saved);
      const device = await store.device();
      if (!device) {
        rememberReturning(false);
        return setBoot({ s: "signedOut", store });
      }
      void loadShell().catch(() => undefined);
      const engine = createEngine(device, store);
      activeEngineRef.current = engine;
      // The frame opens on what this browser holds (no network yet), where the person left off; then it syncs.
      await engine.open();
      reopenLastPlace(engine);
      setBoot({ s: "ready", engine, reauth: false });
      await engine.start();
      startNotifications(engine);
    } catch (e) {
      setBoot({ s: "error", message: e instanceof Error ? e.message : "Meldiq couldn't start." });
    }
  }, []);

  // New releases reach this tab without a manual refresh (src/application/updates.ts).
  useEffect(() => watchForUpdates(), []);

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
      // Nothing keeps playing once the account is no longer signed in here.
      if (st.phase === "revoked" || st.phase === "reauth") voicePlayback.reset();
      if (st.phase === "revoked") {
        engine.stop();
        forgetPlace();
        forgetReadingPositions();
        rememberReturning(false);
        void LocalStore.erase(engine.store)
          .then(() => forgetAccount(engine.store.name))
          .finally(() => setBoot({ s: "revoked", reason: st.phaseReason }));
        return;
      }
      const reauth = st.phase === "reauth";
      setBoot((b) => (b.s === "ready" && b.engine === engine && b.reauth !== reauth ? { ...b, reauth } : b));
    });
  }, [engine]);

  const linked = useCallback(async (store: LocalStore, device: DeviceRecord, grant: SessionGrant | AccountSessionGrant) => {
    await store.saveDevice(device);
    await rememberAccount(store.name, device);
    setDirectory(await accountDirectory());
    const engine = createEngine(device, store);
    activeEngineRef.current = engine;
    setBoot({ s: "ready", engine, reauth: false });
    await engine.start(grant);
    startNotifications(engine);
  }, []);

  const saveAccountDevice = useCallback(async (store: LocalStore, device: DeviceRecord, grant: AccountSessionGrant) => {
    await store.saveDevice(device);
    await new TokenVault(store).save(tokensOf(grant));
    await rememberAccount(store.name, device, grant.account.name);
    setDirectory(await accountDirectory());
  }, []);

  const signedOut = useCallback(async () => {
    voicePlayback.reset();
    forgetPlace();
    forgetReadingPositions();
    rememberReturning(false);
    resetPrefs();
    forgetRecentSearches();
    if (engine) await forgetAccount(engine.store.name);
    // Reload into the remaining saved account, or the ordinary sign-in screen.
    location.replace("/");
  }, [engine]);

  /** From "Sign in again": signs this browser out without a session (it can't remove itself from the account first). */
  const eraseAndSignOut = useCallback(
    async (engine: Engine) => {
      // No session, so nothing can be backed up or removed first: the history keeps what other devices sent it.
      await signOut(engine, true, true).catch(() => LocalStore.erase(engine.store));
      await signedOut();
    },
    [signedOut],
  );

  return (
    <>
      {directory?.pending && (boot.s === "signedOut" || boot.s === "phoneLink") && (
        <div className="adding-account-bar">
          <span>Add another account · your other accounts stay signed in</span>
          <button className="btn btn-secondary btn-sm" onClick={() => void cancelAddingAccount().then(() => location.replace("/"))}>
            Cancel adding account
          </button>
        </div>
      )}
      {boot.s === "ready" && boot.reauth && directory && directory.accounts.length > 1 && (
        <div className="adding-account-bar">
          <span>This account needs you to sign in again.</span>
          {directory.accounts
            .filter((a) => a.database !== boot.engine.store.name)
            .map((a) => (
              <button key={a.database} className="btn btn-secondary btn-sm" onClick={() => void selectAccount(a.database).then(() => location.replace("/"))}>
                Use {a.displayName}
              </button>
            ))}
        </div>
      )}
      {screenFor()}
      <UpdateNotice />
    </>
  );

  function screenFor() {
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
          <AuthScreen
            savedAccounts={directory?.accounts ?? []}
            onUseSavedAccount={(database) => void selectAccount(database).then(() => location.replace("/"))}
            onSave={(d, g) => saveAccountDevice(boot.store, d, g)}
            onReady={(d, g) => void linked(boot.store, d, g)}
            onLinkWithPhone={() => TEST_DEVICE_LINKING && setBoot({ s: "phoneLink", store: boot.store })}
          />
        );
      case "phoneLink":
        // Development and the browser tests only (auth/testLinking.ts): release builds leave this screen out.
        return TEST_DEVICE_LINKING ? (
          <Suspense fallback={null}>
            <LinkScreen onLinked={(d, g) => void linked(boot.store, d, g)} onBack={() => setBoot({ s: "signedOut", store: boot.store })} />
          </Suspense>
        ) : null;
      case "ready":
        if (boot.reauth) return <ReauthScreen engine={boot.engine} onSignOut={() => void eraseAndSignOut(boot.engine)} />;
        return (
          <EngineProvider engine={boot.engine}>
            <Suspense fallback={<LoadingScreen />}>
              <AccountActionsProvider onSignedOut={signedOut}>
                <Shell onSignedOut={() => void signedOut()} />
              </AccountActionsProvider>
            </Suspense>
          </EngineProvider>
        );
    }
  }
}
