import { useSyncExternalStore } from "react";

/**
 * Installing Meldiq as an app (brief v4 §17). Chromium browsers say when the app can be installed
 * (`beforeinstallprompt`); Meldiq keeps that offer and shows one quiet "Install Meldiq" button where you'd look for
 * it (Settings › About, the phone's You tab), never a banner or a repeated prompt. Safari on iPhone and iPad has no
 * such event: there it's Share › Add to Home Screen, which Settings › About explains. Opened as an installed app, none
 * of this shows.
 */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallState = "installed" | "available" | "ios" | "unavailable";

let offer: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

/** Called once at start-up, before the browser's event can fire. */
export function watchInstall(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // no mini-infobar: the offer waits for the person to choose Install
    offer = e as InstallPromptEvent;
    changed();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    offer = null;
    changed();
  });
}

function standalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function installState(): InstallState {
  if (installed || standalone()) return "installed";
  if (offer) return "available";
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  // iPhone and iPad Safari (iPadOS reports a Mac with touch).
  if (/iPhone|iPad/.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1)) return "ios";
  return "unavailable";
}

/** Shows the browser's own install dialog; true when the person installed. */
export async function install(): Promise<boolean> {
  const o = offer;
  if (!o) return false;
  offer = null; // the event can be used once
  changed();
  await o.prompt();
  return (await o.userChoice).outcome === "accepted";
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    installState,
    () => "unavailable" as const,
  );
}
