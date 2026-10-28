import type { UserLite } from "../../state/store";

/** How many names a reaction's hover card lists before "and N more" (the full list is in the Reactions dialog). */
export const REACTOR_PREVIEW = 8;

export interface Reactor {
  id: string;
  name: string;
  me: boolean;
}

/**
 * Who chose one reaction, for its hover card and the Reactions dialog: each person once (a reaction that arrived both
 * live and from the backlog isn't listed twice), you first, then in the order they reacted. Names come from the people
 * this browser already knows: everyone who reacted is a member of the conversation, so nothing new is revealed.
 */
export function reactorsOf(userIds: readonly string[], users: Readonly<Record<string, UserLite | undefined>>, myUserId: string, youLabel: string, unknownLabel: string): Reactor[] {
  const seen = new Set<string>();
  const out: Reactor[] = [];
  for (const id of userIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const u = users[id];
    const me = id === myUserId;
    out.push({ id, me, name: me ? youLabel : (u?.displayName ?? u?.username ?? unknownLabel) });
  }
  return out.sort((a, b) => Number(b.me) - Number(a.me));
}

/** The first [limit] reactors and how many more there are. */
export function previewOf(reactors: readonly Reactor[], limit = REACTOR_PREVIEW): { shown: Reactor[]; more: number } {
  return { shown: reactors.slice(0, limit), more: Math.max(0, reactors.length - limit) };
}
