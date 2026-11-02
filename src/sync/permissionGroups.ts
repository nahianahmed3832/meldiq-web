/**
 * The reference's permission groups (docs/MELDIQ_COMMUNITY_PARITY.md §1 Roles › Permissions; Edit channel ›
 * Permissions), over Meldiq's keys. Labels and hints come from the server's catalog; this only orders them. Keys a
 * newer server adds that aren't listed here go to "More", so nothing is ever hidden.
 */
export type PermissionGroupKey = "general" | "membership" | "text" | "voice" | "advanced" | "more";

export const PERMISSION_GROUP_LABEL: Record<PermissionGroupKey, string> = {
  general: "General",
  membership: "Membership",
  text: "Text",
  voice: "Voice",
  advanced: "Advanced",
  more: "More",
};

const GROUPS: readonly [PermissionGroupKey, readonly string[]][] = [
  [
    "general",
    [
      "channels.view",
      "channels.manage",
      "channels.create",
      "channels.visibility",
      "roles.view",
      "roles.manage",
      "expressions.manage",
      "workspace.edit",
      "webhooks.manage",
      "audit.view",
      "members.view",
      "members.invite",
      "members.invites.manage",
      "members.nickname",
      "members.nicknames",
      "members.titles",
    ],
  ],
  ["membership", ["members.remove", "members.ban", "members.timeout", "members.approve", "members.roles", "roles.assign", "reports.view"]],
  [
    "text",
    [
      "messages.post",
      "messages.embed",
      "messages.attach",
      "messages.voice",
      "messages.react",
      "messages.external_emoji",
      "messages.polls",
      "messages.big_text",
      "messages.mention_all",
      "messages.manage",
      "messages.bypass_slowmode",
      "messages.announce",
      "threads.create",
      "threads.post",
      "threads.manage",
      "messages.history",
    ],
  ],
  ["voice", ["voice.connect", "voice.speak", "voice.mute_members", "voice.move_members"]],
  ["advanced", ["roles.delegate", "workspace.usage.view", "workspace.transfer", "workspace.delete"]],
];

const ORDER = new Map<string, { group: PermissionGroupKey; index: number }>(GROUPS.flatMap(([group, keys]) => keys.map((key, index) => [key, { group, index }] as const)));

export interface PermissionGroup<T> {
  key: PermissionGroupKey;
  label: string;
  items: T[];
}

/** [items] (anything with a permission key) in the reference's groups and order; empty groups are left out. */
export function groupPermissions<T extends { key: string }>(items: readonly T[]): PermissionGroup<T>[] {
  const keys: PermissionGroupKey[] = ["general", "membership", "text", "voice", "advanced", "more"];
  return keys
    .map((g) => ({
      key: g,
      label: PERMISSION_GROUP_LABEL[g],
      items: items.filter((i) => (ORDER.get(i.key)?.group ?? "more") === g).sort((a, b) => (ORDER.get(a.key)?.index ?? 99) - (ORDER.get(b.key)?.index ?? 99)),
    }))
    .filter((g) => g.items.length > 0);
}

/** The items whose label, hint or key contains [query] (case-insensitive); all of them for an empty query. */
export function searchPermissions<T extends { key: string; label: string; description?: string | null }>(items: readonly T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...items];
  return items.filter((i) => i.label.toLowerCase().includes(q) || (i.description ?? "").toLowerCase().includes(q) || i.key.toLowerCase().includes(q));
}

/** Roles given automatically carry no permissions or restrictions (the server refuses: auto_role_has_powers). */
export function autoRoleProblem(mode: "none" | "everyone" | "joined_before", grants: number, denies: number): string | null {
  if (mode === "none" || grants + denies === 0) return null;
  return "A role given automatically can't carry permissions or restrictions. Clear them on Permissions, or give it to Nobody.";
}

/** [ids] with the one at [index] moved by [by] places (up is -1); unchanged at the ends. */
export function moveInOrder(ids: readonly string[], index: number, by: number): string[] {
  const to = index + by;
  if (index < 0 || index >= ids.length || to < 0 || to >= ids.length) return [...ids];
  const next = [...ids];
  const [moved] = next.splice(index, 1);
  next.splice(to, 0, moved);
  return next;
}

/** [ids] with [id] dropped just before [beforeId] (drag and drop). */
export function dropBefore(ids: readonly string[], id: string, beforeId: string): string[] {
  if (id === beforeId) return [...ids];
  const rest = ids.filter((x) => x !== id);
  const at = rest.indexOf(beforeId);
  if (at < 0) return [...ids];
  return [...rest.slice(0, at), id, ...rest.slice(at)];
}
