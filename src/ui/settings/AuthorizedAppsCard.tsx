import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { AppWindow } from "lucide-react";
import { useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { oauthGrants, revokeGrant, SCOPE_WORDS } from "../../sync/oauth";
import { relative } from "../format";
import { useAction, useLoad } from "../workspace/useLoad";
/**
 * Settings › Privacy & security › Authorised apps (API 0.65.0 batch B): the apps you signed in to with "Log in with
 * Meldiq", what each may see, and Revoke, which stops its tokens at once.
 */
export function AuthorizedAppsCard() {
  useLocaleRender();
  const engine = useEngine();
  const offered = useOrbit((s) => s.server?.features.includes("oauth-apps") ?? false);
  const [version, setVersion] = useState(0);
  const list = useLoad(() => (offered ? oauthGrants(engine) : Promise.resolve(null)), [engine, offered, version]);
  const act = useAction();
  if (!offered) return null;
  const grants = list.data ?? [];
  return (
    <div className="card setting-card" aria-label={uiText("settings.interface.authorised_apps_a2bff43")}>
      <span className="lines">
        <strong>
          <Localized k="settings.interface.authorised_apps_a2bff43" />
        </strong>
        <small>
          <Localized k="settings.interface.apps_and_websites_you_signed_in_to_with_your_meldiq_account_revok_771c1ac" />
        </small>
      </span>
      {(list.error || act.error) && (
        <div className="banner danger" role="alert">
          {act.error ?? list.error}
        </div>
      )}
      {list.data && grants.length === 0 && (
        <small className="faint">
          <Localized k="settings.interface.you_haven_t_signed_in_to_any_apps_with_meldiq_1ef27bd" />
        </small>
      )}
      {grants.length > 0 && (
        <ul className="ws-list" aria-label={uiText("settings.interface.authorised_apps_a2bff43")}>
          {grants.map((g) => (
            <li key={g.app.id} className="ws-row">
              <AppWindow size={18} className="faint" />
              <span className="lines grow">
                <span className="ellipsis">
                  {g.app.name}
                  {g.app.ownerUsername && (
                    <span className="faint">
                      <Localized k="settings.interface.by_fa72eff" slots={[g.app.ownerUsername]} />
                    </span>
                  )}
                </span>
                <small>
                  <Localized k="settings.interface.since_564f767" slots={[g.scopes.map((s) => SCOPE_WORDS[s] ?? s).join("; "), relative(g.createdAt)]} />
                </small>
              </span>
              <button
                className="btn btn-ghost btn-sm"
                disabled={act.busy}
                onClick={() => {
                  if (window.confirm(uiText("settings.interface.revoke_value0_s_access_it_s_signed_out_at_once_989375c", { value0: g.app.name })))
                    void act.act(() => revokeGrant(engine, g.app.id).then(() => setVersion((v) => v + 1)));
                }}
              >
                <Localized k="settings.interface.revoke_87e6d00" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
