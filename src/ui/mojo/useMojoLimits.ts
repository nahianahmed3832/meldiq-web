import { useEffect } from "react";
import type { PlanPerks } from "../../api/mojoSchemas";
import { useEngine, useOrbit } from "../../application/orbit";

/**
 * The plan limits that apply to this person now (server docs/MOJO.md), or null when the server doesn't enforce them
 * (Mojo not on sale yet, an older server) or they aren't known yet: then the app keeps its old limits. The server
 * checks every limit again; this only lets the app say so before trying.
 */
export function useMojoLimits(): PlanPerks | null {
  return useOrbit((s) => (s.mojo.catalog?.enforced && s.mojo.me ? s.mojo.me.perks : null));
}

/**
 * The largest file this person may share in [orgId] (or a DM: null): the higher of their plan and the community's Spark
 * level; null when limits aren't enforced. Reads the community's level the first time it's asked.
 */
export function useUploadLimit(orgId: string | null): number | null {
  const engine = useEngine();
  const limits = useMojoLimits();
  const level = useOrbit((s) => (orgId ? (s.mojo.orgs[orgId] ?? null) : null));
  useEffect(() => {
    if (limits && orgId && !level) void engine.mojo.loadOrg(orgId);
  }, [engine, limits, orgId, level]);
  if (!limits) return null;
  return Math.max(limits.uploadBytes, level?.perks.uploadBytes ?? 0);
}
