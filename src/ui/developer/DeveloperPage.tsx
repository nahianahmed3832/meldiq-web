import { useOrbit } from "../../application/orbit";
import { apiBase } from "../../application/config";
import { AppsSection } from "./AppsSection";
import { BotsSection } from "./BotsSection";

/**
 * Settings › Developer (API 0.65.0 batch B, the reference's Developer page): bots, and "Log in with Meldiq" apps, each
 * shown on servers that have it. Secrets and tokens are shown once; Meldiq keeps only their hashes.
 */
export function DeveloperPage() {
  const bots = useOrbit((s) => s.server?.features.includes("bots") ?? false);
  const apps = useOrbit((s) => s.server?.features.includes("oauth-apps") ?? false);
  const apiOrigin = apiBase() || location.origin;
  return (
    <>
      <h1>Developer</h1>
      <p className="muted">Build on Meldiq: bots that post and answer slash commands in communities, and apps people sign in to with their Meldiq account.</p>
      {!bots && !apps && <p className="muted">This server doesn't offer bots or apps yet.</p>}
      {bots && <BotsSection apiOrigin={apiOrigin} />}
      {apps && <AppsSection webOrigin={location.origin} />}
    </>
  );
}
