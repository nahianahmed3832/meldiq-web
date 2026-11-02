/**
 * Mentioning a community role (community parity A1): the composer offers mentionable roles (every role to holders of
 * messages.mention_all), puts `@Role name` in the text and sends the role's id in `roleMentions`; the server checks it.
 */
export interface MentionRole {
  id: string;
  name: string;
  color: string | null;
  mentionable: boolean;
}

/** The roles this person may mention, matching [query] (case-insensitive, by the start of any word). */
export function mentionableRoles(roles: readonly MentionRole[], anyRole: boolean, query: string): MentionRole[] {
  const q = query.toLowerCase();
  return roles.filter(
    (r) =>
      (anyRole || r.mentionable) &&
      (q === "" ||
        r.name
          .toLowerCase()
          .split(/\s+/)
          .some((w) => w.startsWith(q)) ||
        r.name.toLowerCase().startsWith(q)),
  );
}

/** The text the composer puts in for a role. */
export const roleToken = (name: string): string => `@${name}`;

/** The picked roles whose `@Role name` is still in [text] (in the order picked). */
export function rolesStillMentioned(text: string, picked: readonly MentionRole[]): string[] {
  const ids: string[] = [];
  for (const r of picked) if (text.includes(roleToken(r.name)) && !ids.includes(r.id)) ids.push(r.id);
  return ids;
}
