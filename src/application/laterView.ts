import { z } from "zod";
import type { LocalStore } from "../store/db";

const schema = z.object({
  tab: z.enum(["saved", "reminders"]),
  filter: z.enum(["open", "done", "all"]),
  query: z.string().max(100),
  collectionId: z.string().max(128),
});
export type LaterViewState = z.infer<typeof schema>;
export const DEFAULT_LATER_VIEW: LaterViewState = { tab: "saved", filter: "open", query: "", collectionId: "" };
const writes = new WeakMap<object, Promise<void>>();

export async function readLaterView(store: Pick<LocalStore, "laterView">): Promise<LaterViewState> {
  // A quick Back navigation may remount the view while its last edit is still being written.
  await writes.get(store);
  const parsed = schema.safeParse(await store.laterView());
  return parsed.success ? parsed.data : { ...DEFAULT_LATER_VIEW };
}

/** Serialize writes so a slow older edit cannot replace the latest filters. Failure does not poison the queue. */
export class LaterViewWriter {
  constructor(private readonly store: Pick<LocalStore, "saveLaterView">) {}

  write(value: LaterViewState): Promise<void> {
    const snapshot = schema.parse(value);
    const next = (writes.get(this.store) ?? Promise.resolve()).then(() => this.store.saveLaterView(snapshot));
    writes.set(
      this.store,
      next.catch(() => undefined),
    );
    return next;
  }
}
