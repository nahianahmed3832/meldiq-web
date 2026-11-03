import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { Download } from "lucide-react";
import { install, useInstallState } from "../../application/install";
/** "Install Meldiq" while the browser offers it (application/install.ts); nothing otherwise. */
export function InstallButton({ className = "btn btn-secondary btn-sm" }: { className?: string }) {
  useLocaleRender();
  const state = useInstallState();
  if (state !== "available") return null;
  return (
    <button className={className} onClick={() => void install()}>
      <Localized k="settings.interface.install_meldiq_3d4f970" slots={[<Download size={15} aria-hidden="true" />]} />
    </button>
  );
}
/** Settings › About: installing as an app, the way this browser does it. */
export function InstallSetting() {
  useLocaleRender();
  const state = useInstallState();
  if (state === "unavailable") return null;
  return (
    <div className="setting">
      <div className="lines">
        <strong>
          <Localized k="settings.interface.meldiq_as_an_app_f38143f" />
        </strong>
        <small>
          {state === "installed"
            ? uiText("settings.interface.you_re_using_meldiq_as_an_installed_app_a7a0969")
            : state === "ios"
              ? uiText("settings.interface.in_safari_tap_share_then_add_to_home_screen_meldiq_then_opens_on_b9b57cc")
              : uiText("settings.interface.its_own_window_and_icon_opened_like_any_app_73b433f")}
        </small>
      </div>
      <InstallButton />
    </div>
  );
}
