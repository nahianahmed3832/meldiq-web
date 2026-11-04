import { z } from "zod";
import { zManagedPoll } from "../protocol/payload";
import type { Engine } from "./engine";
export const zManagedPollState = z.object({
  id: z.string(),
  poll: zManagedPoll,
  closed: z.boolean(),
  rev: z.number().int().positive(),
  mine: z.object({ choices: z.array(z.string()), anonymous: z.boolean() }).nullable(),
  total: z.number().int().nonnegative(),
  counts: z.array(z.object({ id: z.string(), votes: z.number().int().nonnegative() })),
  voters: z.array(z.object({ userId: z.string().nullable(), choices: z.array(z.string()) })),
  correctOptionIds: z.array(z.string()).nullable(),
  canClose: z.boolean(),
});
export type ManagedPollState = z.infer<typeof zManagedPollState>;
export const getManagedPoll = (engine: Engine, id: string) => engine.api.json("GET", `/v1/polls/${encodeURIComponent(id)}`, zManagedPollState);
export const voteManagedPoll = (engine: Engine, id: string, choices: string[], anonymous: boolean) =>
  engine.api.json("PUT", `/v1/polls/${encodeURIComponent(id)}/vote`, zManagedPollState, { body: { choices, anonymous } });
export const closeManagedPoll = (engine: Engine, id: string) => engine.api.json("POST", `/v1/polls/${encodeURIComponent(id)}/close`, zManagedPollState, { body: {} });
