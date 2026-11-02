import { useEffect, useState } from "react";
import type { Org } from "../../api/schemas";
import { useEngine, useOrbit } from "../../application/orbit";
import type { CommunityAccess } from "../../sync/channelGates";
import type { Engine } from "../../sync/engine";
import { workspaceDetail } from "../../sync/workspaces";

/**
 * This person's effective permissions and roles in a community (GET /v1/orgs/:id), shared by every composer and message
 * list of it and loaded again whenever the community changes (the org list refreshes on org.updated).
 */
const caches = new WeakMap<Engine, Map<string, { org: Org; access: Promise<CommunityAccess | null> }>>();

function load(engine: Engine, org: Org): Promise<CommunityAccess | null> {
  let cache = caches.get(engine);
  if (!cache) {
    cache = new Map();
    caches.set(engine, cache);
  }
  const hit = cache.get(org.id);
  if (hit && hit.org === org) return hit.access;
  const access = workspaceDetail(engine, org.id)
    .then((d) => ({ isOwner: d.permissions.isOwner, effective: d.permissions.effective, myRoleIds: d.myRoles.map((r) => r.id) }))
    .catch(() => null);
  cache.set(org.id, { org, access });
  return access;
}

export function useCommunityAccess(orgId: string | null): CommunityAccess | null {
  const engine = useEngine();
  const org = useOrbit((s) => (orgId ? (s.orgs.find((o) => o.id === orgId) ?? null) : null));
  const [result, setResult] = useState<{ org: Org; access: CommunityAccess | null } | null>(null);
  useEffect(() => {
    if (!org) return setResult(null);
    let alive = true;
    void load(engine, org).then((a) => alive && setResult({ org, access: a }));
    return () => {
      alive = false;
    };
  }, [engine, org]);
  return result?.org === org ? (result?.access ?? null) : null;
}

/** Whether the server announces [feature]. */
export function useFeature(feature: string): boolean {
  return useOrbit((s) => s.server?.features.includes(feature) ?? false);
}
