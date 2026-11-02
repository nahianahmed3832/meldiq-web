/** A custom role as the member directory gives it (batch B12): its colour, and whether it heads its own group. */
export interface ListedRole {
  id: string;
  name: string;
  color: string | null;
  hoist: boolean;
  position: number;
  /** Community parity A1: the colour it fades into (a gradient role colour), or null. */
  color2?: string | null;
}

export interface ListedMember {
  id: string;
  displayName: string;
  presence: "online" | "idle" | "dnd" | "offline" | null;
  online: boolean | null;
  /** A bot (people's bots and Meldiq's official ones): listed under Bots, whatever its presence. */
  bot?: boolean;
  /** The community's protected base role, independent of custom role ordering. */
  orgRole?: string | null;
}

export interface MemberListGroup<T> {
  key: string;
  /** "Admin", a custom role's name, "Online", "Bots" or "Offline". */
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

/** The conversation endpoint can omit bots. Add only bots from the permission-checked community directory. */
export function withCommunityBots<T extends ListedMember>(members: readonly T[], directory: readonly T[]): T[] {
  const listed = new Map(members.map((m) => [m.id, m]));
  for (const bot of directory) {
    if (bot.bot && !listed.has(bot.id)) listed.set(bot.id, bot);
  }
  return [...listed.values()];
}

/** The colour a person's name takes in the member list: their highest role that has one. */
export function nameColor(roles: readonly ListedRole[] | undefined): string | null {
  return [...(roles ?? [])].sort(byPosition).find((r) => r.color)?.color ?? null;
}

/** Their highest coloured role's colours: one, or two for a gradient (community parity A1); null without any. */
export function roleNameColors(roles: readonly ListedRole[] | undefined): string[] | null {
  const top = [...(roles ?? [])].sort(byPosition).find((r) => r.color);
  if (!top?.color) return null;
  return top.color2 ? [top.color, top.color2] : [top.color];
}

/**
 * Active owners lead the list, under their highest separately displayed custom role or Admin by default.
 * Their group leads regardless of custom role position, and owners lead that group's members. Other active people
 * follow their role order, then Online. Bots always have their own group; offline people stay under Offline.
 */
export function memberListGroups<T extends ListedMember>(members: readonly T[], rolesOf: (userId: string) => readonly ListedRole[] | undefined): MemberListGroup<T>[] {
  const alpha = (a: T, b: T) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" });
  const ownerFirst = (a: T, b: T) => Number(b.orgRole === "OWNER") - Number(a.orgRole === "OWNER") || alpha(a, b);
  const isAdmin = (m: T) => m.orgRole === "OWNER" || m.orgRole === "ADMIN";
  const topHoisted = (m: T) => [...(rolesOf(m.id) ?? [])].filter((r) => r.hoist).sort(byPosition)[0] ?? null;
  const people = members.filter((m) => !m.bot);
  const bots = members.filter((m) => m.bot);
  const here = people.filter(isHere);
  const away = people.filter((m) => !isHere(m));

  const roles = new Map<string, ListedRole>();
  for (const m of here) {
    const r = topHoisted(m);
    if (r && !roles.has(r.id)) roles.set(r.id, r);
  }
  const roleGroups = [...roles.values()].sort(byPosition).map((r) => ({
    key: `role:${r.id}`,
    label: r.name,
    color: r.color,
    members: here.filter((m) => topHoisted(m)?.id === r.id).sort(ownerFirst),
  }));
  const activeGroups: MemberListGroup<T>[] = [
    { key: "admin", label: "Admin", color: null, members: here.filter((m) => isAdmin(m) && topHoisted(m) === null).sort(ownerFirst) },
    ...roleGroups,
    { key: "online", label: "Online", color: null, members: here.filter((m) => !isAdmin(m) && topHoisted(m) === null).sort(alpha) },
  ];
  activeGroups.sort((a, b) => Number(b.members.some((m) => m.orgRole === "OWNER")) - Number(a.members.some((m) => m.orgRole === "OWNER")));
  const groups: MemberListGroup<T>[] = [
    ...activeGroups,
    { key: "bots", label: "Bots", color: null, members: [...bots].sort(alpha) },
    { key: "offline", label: "Offline", color: null, members: [...away].sort(alpha) },
  ];
  return groups.filter((g) => g.members.length > 0);
}
