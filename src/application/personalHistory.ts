import { z } from "zod";
import type { LocalStore } from "../store/db";
import { remember } from "../sync/universalSearch";

const DAY = 86_400_000;
const LIMIT = 100;
export const HISTORY_EVENT = "meldiq:personal-history";

const schema = z.object({
  activityOn: z.boolean(),
  searchOn: z.boolean(),
  visits: z.array(z.object({ id: z.string(), at: z.number() })).max(LIMIT),
  searches: z.array(z.object({ query: z.string().max(60), at: z.number() })).max(6),
});
export type PersonalHistory = z.infer<typeof schema>;
function live(raw: unknown, at = Date.now()): PersonalHistory {
  const value = schema.safeParse(raw);
  if (!value.success) return { activityOn: false, searchOn: true, visits: [], searches: [] };
  return {
    ...value.data,
    visits: value.data.visits.filter((row) => row.at > at - 30 * DAY),
    searches: value.data.searches.filter((row) => row.at > at - 30 * DAY),
  };
}

export async function readPersonalHistory(store: LocalStore): Promise<PersonalHistory> {
  // A read also removes expired data from the browser database.
  return store.updatePersonalHistory((value) => live(value));
}

async function change(store: LocalStore, apply: (current: PersonalHistory, at: number) => PersonalHistory): Promise<PersonalHistory> {
  const at = Date.now();
  const next = await store.updatePersonalHistory((value) => apply(live(value, at), at));
  window.dispatchEvent(new CustomEvent(HISTORY_EVENT, { detail: store.name }));
  return next;
}

export function recordVisit(store: LocalStore, id: string) {
  return change(store, (current, at) => {
    if (!current.activityOn) return current;
    return { ...current, visits: [{ id, at }, ...current.visits.filter((v) => v.id !== id)].slice(0, LIMIT) };
  });
}

export function recordSearch(store: LocalStore, query: string) {
  return change(store, (current, at) => {
    if (!current.searchOn) return current;
    const prior = current.searches.map((entry) => entry.query);
    return {
      ...current,
      searches: remember(prior, query).map((value, index) => ({
        query: value,
        at: index === 0 ? at : (current.searches.find((entry) => entry.query === value)?.at ?? at),
      })),
    };
  });
}

export function updateHistory(store: LocalStore, op: { type: "activity" | "search"; enabled: boolean } | { type: "clearActivity" | "clearSearch" } | { type: "removeVisit"; id: string }) {
  return change(store, (current) => {
    switch (op.type) {
      case "activity":
        return { ...current, activityOn: op.enabled, visits: op.enabled ? current.visits : [] };
      case "search":
        return { ...current, searchOn: op.enabled, searches: op.enabled ? current.searches : [] };
      case "clearActivity":
        return { ...current, visits: [] };
      case "clearSearch":
        return { ...current, searches: [] };
      case "removeVisit":
        return { ...current, visits: current.visits.filter((v) => v.id !== op.id) };
    }
  });
}
