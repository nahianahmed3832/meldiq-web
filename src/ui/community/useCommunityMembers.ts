import { useEffect, useState } from "react";
import type { DirectoryMember } from "../../api/workspaceSchemas";
import { useEngine } from "../../application/orbit";
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
}

const TTL_MS = 60_000;
const EMPTY: CommunityMembers = { roles: new Map(), nicknames: new Map() };
const cache = new Map<string, { at: number; members: CommunityMembers }>();
const loading = new Map<string, Promise<CommunityMembers>>();

export function membersFrom(people: readonly DirectoryMember[]): CommunityMembers {
  return {
    roles: new Map(people.map((p) => [p.id, p.customRoles.map((r) => ({ ...r, color2: r.color2 ?? null }))])),
    nicknames: new Map(people.flatMap((p) => (p.nickname?.trim() ? [[p.id, p.nickname] as const] : []))),
  };
}

function load(engine: Engine, orgId: string): Promise<CommunityMembers> {
  let p = loading.get(orgId);
  if (!p) {
    p = directory(engine, orgId)
      .then((people) => {
        const members = membersFrom(people);
        cache.set(orgId, { at: Date.now(), members });
        return members;
      })
      .catch(() => EMPTY)
      .finally(() => loading.delete(orgId));
    loading.set(orgId, p);
  }
  return p;
}

/** Forgets a community's directory (after changing a nickname), so the next view loads it again. */
export function forgetCommunityMembers(orgId: string): void {
  cache.delete(orgId);
}

export function useCommunityMembers(orgId: string | null, version = 0): CommunityMembers {
  const engine = useEngine();
  const [members, setMembers] = useState<CommunityMembers>((orgId && cache.get(orgId)?.members) || EMPTY);
  useEffect(() => {
    if (!orgId) return setMembers(EMPTY);
    const hit = cache.get(orgId);
    if (hit && Date.now() - hit.at < TTL_MS) return setMembers(hit.members);
    let alive = true;
    void load(engine, orgId).then((m) => alive && setMembers(m));
    return () => {
      alive = false;
    };
  }, [engine, orgId, version]);
  return members;
}
