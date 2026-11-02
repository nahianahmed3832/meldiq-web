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
  const engine = useEngine();
  const offered = useOrbit((s) => s.server?.features.includes("oauth-apps") ?? false);
  const [version, setVersion] = useState(0);
  const list = useLoad(() => (offered ? oauthGrants(engine) : Promise.resolve(null)), [engine, offered, version]);
  const act = useAction();
  if (!offered) return null;
  const grants = list.data ?? [];
  return (
    <div className="card setting-card" aria-label="Authorised apps">
      <span className="lines">
        <strong>Authorised apps</strong>
        <small>Apps and websites you signed in to with your Meldiq account. Revoking one signs you out of it; it can ask again next time.</small>
      </span>
      {(list.error || act.error) && (
        <div className="banner danger" role="alert">
          {act.error ?? list.error}
        </div>
      )}
      {list.data && grants.length === 0 && <small className="faint">You haven't signed in to any apps with Meldiq.</small>}
      {grants.length > 0 && (
        <ul className="ws-list" aria-label="Authorised apps">
          {grants.map((g) => (
            <li key={g.app.id} className="ws-row">
              <AppWindow size={18} className="faint" />
              <span className="lines grow">
                <span className="ellipsis">
                  {g.app.name}
                  {g.app.ownerUsername && <span className="faint"> · by @{g.app.ownerUsername}</span>}
                </span>
                <small>
                  {g.scopes.map((s) => SCOPE_WORDS[s] ?? s).join("; ")} · since {relative(g.createdAt)}
                </small>
              </span>
              <button
                className="btn btn-ghost btn-sm"
                disabled={act.busy}
                onClick={() => {
                  if (window.confirm(`Revoke ${g.app.name}'s access? It's signed out at once.`)) void act.act(() => revokeGrant(engine, g.app.id).then(() => setVersion((v) => v + 1)));
                }}
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
