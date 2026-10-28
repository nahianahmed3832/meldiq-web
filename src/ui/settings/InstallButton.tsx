import { Download } from "lucide-react";
import { install, useInstallState } from "../../application/install";

/** "Install Meldiq" while the browser offers it (application/install.ts); nothing otherwise. */
export function InstallButton({ className = "btn btn-secondary btn-sm" }: { className?: string }) {
  const state = useInstallState();
  if (state !== "available") return null;
  return (
    <button className={className} onClick={() => void install()}>
      <Download size={15} aria-hidden="true" /> Install Meldiq
    </button>
  );
}

/** Settings › About: installing as an app, the way this browser does it. */
export function InstallSetting() {
  const state = useInstallState();
  if (state === "unavailable") return null;
  return (
    <div className="setting">
      <div className="lines">
        <strong>Meldiq as an app</strong>
        <small>
          {state === "installed"
            ? "You're using Meldiq as an installed app."
            : state === "ios"
              ? "In Safari, tap Share, then Add to Home Screen. Meldiq then opens on its own, without the browser's bars."
              : "Its own window and icon, opened like any app."}
        </small>
      </div>
      <InstallButton />
    </div>
  );
}
