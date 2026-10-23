/** A custom role as the member directory gives it (batch B12): its colour, and whether it heads its own group. */
export interface ListedRole {
  id: string;
  name: string;
  color: string | null;
  hoist: boolean;
  position: number;
}

export interface ListedMember {
  id: string;
  displayName: string;
  presence: "online" | "idle" | "dnd" | "offline" | null;
  online: boolean | null;
}

export interface MemberListGroup<T> {
  key: string;
  /** "Owner", a role's name, "Online" or "Offline". */
  label: string;
  /** The role's colour for its heading, when it has one. */
  color: string | null;
  members: T[];
}

/** Online, idle and do not disturb count as here; offline, or presence hidden by their last-seen setting, doesn't. */
export function isHere(m: Pick<ListedMember, "presence" | "online">): boolean {
  if (m.presence) return m.presence !== "offline";
  return m.online === true;
}

const byPosition = (a: ListedRole, b: ListedRole) => a.position - b.position || a.name.localeCompare(b.name);

/** The colour a person's name takes in the member list: their highest role that has one. */
export function nameColor(roles: readonly ListedRole[] | undefined): string | null {
  return [...(roles ?? [])].sort(byPosition).find((r) => r.color)?.color ?? null;
}

/**
 * A channel's or group's member list, as Discord shows it: people who are here, each under their highest role that's
 * shown separately (in role order) or else under Online; then everyone else under Offline. Names sort alphabetically
 * in each group; empty groups are left out.
 */
export function memberListGroups<T extends ListedMember>(members: readonly T[], rolesOf: (userId: string) => readonly ListedRole[] | undefined): MemberListGroup<T>[] {
  const alpha = (a: T, b: T) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" });
  const topHoisted = (m: T) => [...(rolesOf(m.id) ?? [])].filter((r) => r.hoist).sort(byPosition)[0] ?? null;
  const here = members.filter(isHere);
  const away = members.filter((m) => !isHere(m));

  const roles = new Map<string, ListedRole>();
  for (const m of here) {
    const r = topHoisted(m);
    if (r && !roles.has(r.id)) roles.set(r.id, r);
  }
  const roleGroups = [...roles.values()].sort(byPosition).map((r) => ({
    key: `role:${r.id}`,
    label: r.name,
    color: r.color,
    members: here.filter((m) => topHoisted(m)?.id === r.id).sort(alpha),
  }));
  const groups: MemberListGroup<T>[] = [
    ...roleGroups,
    { key: "online", label: "Online", color: null, members: here.filter((m) => topHoisted(m) === null).sort(alpha) },
    { key: "offline", label: "Offline", color: null, members: [...away].sort(alpha) },
  ];
  return groups.filter((g) => g.members.length > 0);
}
