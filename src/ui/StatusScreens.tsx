import { useLocaleRender } from "../i18n/Localized";
import { text as uiText } from "../i18n";
import { Localized } from "../i18n/Localized";
import { useT as useLocalization } from "../i18n";
import { MeldlingArt } from "./components/MeldlingArt";
import { BrandMark } from "./components/BrandMark";
export function LoadingScreen() {
  useLocaleRender();
  return (
    <main className="status-screen" aria-busy="true">
      <div className="status-card">
        <BrandMark size={56} />
        <p className="muted">
          <Localized k="workspace.interface.opening_meldiq_bd0ec09" />
        </p>
      </div>
    </main>
  );
}
export function UnsupportedScreen({ missing }: { missing: string[] }) {
  useLocaleRender();
  return (
    <main className="status-screen">
      <div className="status-card card">
        <MeldlingArt pose="confused" />
        <h1>
          <Localized k="workspace.interface.this_browser_can_t_run_meldiq_7e03286" />
        </h1>
        <p>
          <Localized k="workspace.interface.meldiq_keeps_your_keys_in_the_browser_and_encrypts_every_message_20bbc0f" slots={[missing.join(", ")]} />
        </p>
        <p className="faint">
          <Localized k="workspace.interface.use_a_current_version_of_chrome_edge_firefox_or_safari_over_https_7248dd0" />
        </p>
      </div>
    </main>
  );
}
/** The page's own configuration is broken (a deployment problem, not the person's). */
export function ConfigError({ message }: { message: string }) {
  useLocaleRender();
  return (
    <main className="status-screen">
      <div className="status-card card">
        <MeldlingArt pose="waving" />
        <h1>
          <Localized k="workspace.interface.meldiq_web_isn_t_set_up_correctly_5b8a144" />
        </h1>
        <p>{message}</p>
        <p className="faint">
          <Localized k="workspace.interface.nothing_was_sent_anywhere_tell_whoever_runs_this_meldiq_server_fe84933" />
        </p>
      </div>
    </main>
  );
}
export function ElsewhereScreen({ onUseHere }: { onUseHere: () => void }) {
  useLocaleRender();
  return (
    <main className="status-screen">
      <div className="status-card card">
        <MeldlingArt pose="confused" />
        <h1>
          <Localized k="workspace.interface.meldiq_is_open_in_another_tab_d7d7915" />
        </h1>
        <p>
          <Localized k="workspace.interface.this_browser_is_one_meldiq_device_and_one_tab_at_a_time_keeps_it_f922295" />
        </p>
        <button className="btn btn-primary btn-lg" onClick={onUseHere}>
          <Localized k="workspace.interface.use_meldiq_here_db486a6" />
        </button>
      </div>
    </main>
  );
}
const REASONS: Record<string, string> = {
  get device_revoked() {
    return uiText("workspace.interface.this_browser_was_removed_from_your_account_from_another_of_your_d_536fedd");
  },
  get account_disabled() {
    return uiText("workspace.interface.your_account_is_disabled_on_this_server_so_this_browser_was_signe_2cc965c");
  },
  get unknown_device() {
    return uiText("workspace.interface.the_server_no_longer_knows_this_browser_it_may_have_been_reset_so_e721fb5");
  },
};
export function RevokedScreen({ reason, message, onLinkAgain }: { reason: string | null; message?: string; onLinkAgain: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  return (
    <main className="status-screen">
      <div className="status-card card">
        <MeldlingArt pose="confused" />
        <h1>{message ? uiText("workspace.interface.meldiq_couldn_t_start_613b995") : uiText("workspace.interface.signed_out_80c6e7c")}</h1>
        <p>{message ?? (reason && REASONS[reason]) ?? uiText("workspace.interface.this_browser_is_no_longer_linked_to_your_account_9abbaa0")}</p>
        <button className="btn btn-primary btn-lg" onClick={onLinkAgain}>
          {message ? l10n("common.actions.retry") : uiText("workspace.interface.link_this_browser_again_62934a9")}
        </button>
      </div>
    </main>
  );
}
