import { lazy, Suspense } from "react";
import { config } from "../../application/config";
import { useEngine } from "../../application/orbit";
import { allowedSupabasePreview } from "../../auth/supabasePreviewConfig";

const StagedSignInCheck = lazy(() => import("./StagedSignInCheck"));

/** No SDK initialization or new sign-in UI on production, including after a cached staging deployment. */
export function MigrationPreviewCard() {
  const engine = useEngine();
  const current = config();
  const preview = allowedSupabasePreview(current.environment, current.supabaseMigration, typeof location === "undefined" ? "" : location.hostname);
  if (!preview || !engine.device.account || !/@example\.(?:test|invalid)$/i.test(engine.device.account.email)) return null;
  return (
    <Suspense fallback={null}>
      <StagedSignInCheck provider={preview} />
    </Suspense>
  );
}
