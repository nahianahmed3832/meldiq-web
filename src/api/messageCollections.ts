import { z } from "zod";
import { zStoredEvent } from "./schemas";

export type CollectionKind = "pins" | "media" | "files" | "threads" | "thread";
export interface CollectionCursor {
  serverTs: number;
  id: string;
}
export const zMessageCollection = z
  .object({
    historySince: z.number().int().nonnegative().nullable(),
    messages: z.array(zStoredEvent),
    context: z.array(zStoredEvent),
    changes: z.array(zStoredEvent),
    threads: z.array(z.object({ rootId: z.string(), replyCount: z.number().int().nonnegative(), lastReplyTs: z.number().int().positive() })),
    more: z.boolean(),
    nextCursor: z.object({ serverTs: z.number().int().positive(), id: z.string() }).nullable(),
  })
  .superRefine((page, ctx) => {
    if (page.more !== (page.nextCursor !== null)) ctx.addIssue({ code: "custom", message: "Incomplete message collection cursor" });
  });
