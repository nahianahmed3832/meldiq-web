import { useEffect, useState, useSyncExternalStore } from "react";
import type { DirectoryMember } from "../../api/workspaceSchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import type { Engine } from "../../sync/engine";
import { directory } from "../../sync/workspaces";
import type { ListedRole } from "../chat/memberListRules";

/**
 * A community's member directory as the chat shows it: each person's custom roles (member list groups and name colours,
 * a role's gradient included) and nickname there (community parity A1). Loaded once a minute per community at most;
 * guests and roles without the directory see plain names.
 */
export interface CommunityMembers {
  roles: Map<string, ListedRole[]>;
  nicknames: Map<string, string>;
  bots: DirectoryMember[];
}

const TTL_MS = 60_000;
const EMPTY: CommunityMembers = { roles: new Map(), nicknames: new Map(), bots: [] };
const cache = new Map<string, { userId: string; at: number; members: CommunityMembers }>();
const loading = new Map<string, Promise<CommunityMembers>>();
const listeners = new Set<() => void>();
let directoryRevision = 0;
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const revision = () => directoryRevision;

export function membersFrom(people: readonly DirectoryMember[]): CommunityMembers {
  return {
    roles: new Map(people.map((p) => [p.id, p.customRoles.map((r) => ({ ...r, color2: r.color2 ?? null }))])),
    nicknames: new Map(people.flatMap((p) => (p.nickname?.trim() ? [[p.id, p.nickname] as const] : []))),
    bots: people.filter((p) => p.bot),
  };
}

function load(engine: Engine, orgId: string, userId: string): Promise<CommunityMembers> {
  const key = JSON.stringify([userId, orgId]);
  let p = loading.get(key);
  if (!p) {
    p = directory(engine, orgId)
      .then((people) => {
        const members = membersFrom(people);
        cache.set(orgId, { userId, at: Date.now(), members });
        return members;
      })
      .catch(() => EMPTY)
      .finally(() => loading.delete(key));
    loading.set(key, p);
  }
  return p;
}

/** Refreshes open member lists after editing role names, assignments or community nicknames. */
export function forgetCommunityMembers(orgId: string): void {
  cache.delete(orgId);
  directoryRevision++;
  listeners.forEach((listener) => listener());
}

export function useCommunityMembers(orgId: string | null, version = 0): CommunityMembers {
  const engine = useEngine();
  const userId = useOrbit((s) => s.me?.userId ?? "");
  const changed = useSyncExternalStore(subscribe, revision, () => 0);
  const [loaded, setLoaded] = useState(() => {
    const hit = orgId ? cache.get(orgId) : undefined;
    return { orgId, userId, members: hit?.userId === userId ? hit.members : EMPTY };
  });
  useEffect(() => {
    const setMembers = (members: CommunityMembers) => setLoaded({ orgId, userId, members });
    if (!orgId) return setMembers(EMPTY);
    const hit = cache.get(orgId);
    if (hit?.userId === userId && Date.now() - hit.at < TTL_MS) return setMembers(hit.members);
    let alive = true;
    void load(engine, orgId, userId).then((m) => alive && setMembers(m));
    return () => {
      alive = false;
    };
  }, [engine, orgId, userId, version, changed]);
  return loaded.orgId === orgId && loaded.userId === userId ? loaded.members : EMPTY;
}
