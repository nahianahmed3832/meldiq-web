import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { useOrbit } from "../../application/orbit";
import { apiBase } from "../../application/config";
import { AppsSection } from "./AppsSection";
import { BotsSection } from "./BotsSection";
/**
 * Settings › Developer (API 0.65.0 batch B, the reference's Developer page): bots, and "Log in with Meldiq" apps, each
 * shown on servers that have it. Secrets and tokens are shown once; Meldiq keeps only their hashes.
 */
export function DeveloperPage() {
  const l10n = useLocalization();
  const bots = useOrbit((s) => s.server?.features.includes("bots") ?? false);
  const apps = useOrbit((s) => s.server?.features.includes("oauth-apps") ?? false);
  const apiOrigin = apiBase() || location.origin;
  return (
    <>
      <h1>{l10n("settings.settings_developer")}</h1>
      <p className="muted">
        <Localized k="workspace.interface.build_on_meldiq_bots_that_post_and_answer_slash_commands_in_commu_e3be2a6" />
      </p>
      {!bots && !apps && (
        <p className="muted">
          <Localized k="workspace.interface.this_server_doesn_t_offer_bots_or_apps_yet_2d279ea" />
        </p>
      )}
      {bots && <BotsSection apiOrigin={apiOrigin} />}
      {apps && <AppsSection webOrigin={location.origin} />}
    </>
  );
}
