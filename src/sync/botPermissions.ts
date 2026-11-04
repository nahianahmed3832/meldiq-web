import { z } from "zod";
import type { Engine } from "./engine";

export const BOT_SCOPES = [
  "communities.read",
  "channels.read",
  "members.read",
  "events.read",
  "direct_messages",
  "channels.manage",
  "roles.manage",
  "members.remove",
  "members.ban",
  "members.timeout",
  "members.nicknames",
  "messages.history",
  "messages.manage",
  "messages.react",
  "messages.post",
  "expressions.manage",
  "members.invite",
  "voice.connect",
  "voice.speak",
  "voice.mute_members",
  "voice.move_members",
  "events.manage",
  "webhooks.manage",
] as const;
export type BotScope = (typeof BOT_SCOPES)[number];
const permissions = z.array(z.enum(BOT_SCOPES));
const manifest = z.object({ botId: z.string(), permissions, rev: z.number().int().nonnegative() });
const installation = z.object({
  orgId: z.string(),
  botId: z.string(),
  permissions,
  manifestRev: z.number().int().nonnegative(),
  rev: z.number().int().nonnegative(),
  approvedBy: z.string().nullable(),
  approvedAt: z.number().nullable(),
});
const review = z.object({ manifest, installation, approvable: permissions });
export type BotPermissionReview = z.infer<typeof review>;
const enc = encodeURIComponent;

export async function requestedBotPermissions(engine: Engine, botId: string) {
  return engine.api.json("GET", `/v2/bots/${enc(botId)}/permissions`, manifest);
}
export async function botPermissionReview(engine: Engine, orgId: string, botId: string) {
  return engine.api.json("GET", `/v1/orgs/${enc(orgId)}/bots/${enc(botId)}/permission-review`, review);
}
export async function requestBotPermissions(engine: Engine, botId: string, selected: BotScope[], rev: number) {
  return engine.api.json("PUT", `/v2/developer/bots/${enc(botId)}/permissions`, manifest, { body: { permissions: selected, rev } });
}
export async function approveBotPermissions(engine: Engine, orgId: string, botId: string, selected: BotScope[], manifestRev: number, rev: number) {
  return engine.api.json("PUT", `/v1/orgs/${enc(orgId)}/bots/${enc(botId)}/permissions`, installation, { body: { permissions: selected, manifestRev, rev } });
}
