import { z } from "zod";
import type { Engine } from "./engine";
export const zThreadState = z.object({
  rootId: z.string(),
  conversationId: z.string(),
  authorId: z.string(),
  rev: z.number().int().nonnegative(),
  deletesParent: z.boolean(),
  closed: z.boolean(),
  locked: z.boolean(),
  deleting: z.boolean(),
  deleted: z.boolean(),
  deletionError: z.enum(["access_changed", "retry_required"]).nullable(),
  deletedReplies: z.number().int().nonnegative(),
  canReply: z.boolean(),
  canClose: z.boolean(),
  canLock: z.boolean(),
  canDelete: z.boolean(),
  following: z.boolean().nullable(),
});
export type ThreadState = z.infer<typeof zThreadState>;
export const zThreadPreferences = z.object({ nextAfter: z.string().nullable(), preferences: z.array(z.object({ rootId: z.string(), conversationId: z.string(), following: z.boolean() })) });
export const zThreadFollowResult = z.object({ rootId: z.string(), following: z.boolean() });
export const getThreadState = (engine: Engine, id: string) => engine.api.json("GET", `/v1/threads/${encodeURIComponent(id)}`, zThreadState);
export const changeThread = (engine: Engine, id: string, baseRev: number, change: { closed?: boolean; locked?: boolean }) =>
  engine.api.json("PATCH", `/v1/threads/${encodeURIComponent(id)}`, zThreadState, { body: { baseRev, ...change } });
export const deleteThread = (engine: Engine, id: string, baseRev: number, deleteParent: boolean) =>
  engine.api.json("POST", `/v1/threads/${encodeURIComponent(id)}/delete`, zThreadState, { body: { baseRev, deleteParent } });
