import { z } from "zod";

const key = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}$/)
  .refine((value) => !["__proto__", "prototype", "constructor"].includes(value));
const label = z.string().trim().min(1).max(80);
const common = { customId: key, label, disabled: z.boolean().optional() };
const field = z
  .object({
    id: key,
    label,
    style: z.enum(["short", "paragraph"]).default("short"),
    required: z.boolean().default(true),
    minLength: z.number().int().min(0).max(1000).default(0),
    maxLength: z.number().int().min(1).max(1000).default(1000),
  })
  .refine((value) => value.minLength <= value.maxLength);
export const zBotComponent = z.union([
  z.object({ ...common, type: z.literal("button") }),
  z
    .object({
      ...common,
      type: z.literal("select"),
      options: z
        .array(z.object({ label, value: key }))
        .min(1)
        .max(25),
      minValues: z.number().int().min(0).max(25).default(1),
      maxValues: z.number().int().min(1).max(25).default(1),
    })
    .refine((value) => value.minValues <= value.maxValues && value.maxValues <= value.options.length && new Set(value.options.map((option) => option.value)).size === value.options.length),
  z.object({ ...common, type: z.literal("form"), fields: z.array(field).min(1).max(5) }).refine((value) => new Set(value.fields.map((item) => item.id)).size === value.fields.length),
]);
export const zBotMessageComponents = z
  .object({ expiresAt: z.number().int().positive(), items: z.array(zBotComponent).min(1).max(5) })
  .refine((value) => new Set(value.items.map((item) => item.customId)).size === value.items.length);
export type BotComponent = z.output<typeof zBotComponent>;
export type BotMessageComponents = z.output<typeof zBotMessageComponents>;
/** A malformed control drops this optional block; its message text remains readable. */
export function cleanBotComponents(value: unknown): BotMessageComponents | null {
  const result = zBotMessageComponents.safeParse(value);
  return result.success ? result.data : null;
}
