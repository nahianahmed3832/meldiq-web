import { z } from "zod";
import type { Engine } from "./engine";

const consent = z.object({
  botId: z.string(),
  enabled: z.boolean(),
  conversationId: z.string().nullable(),
  rev: z.number(),
  manifestRev: z.number(),
  requested: z.boolean(),
  noticeVersion: z.string(),
});
export type BotDmConsent = z.infer<typeof consent>;
const path = (id: string) => `/v2/bots/${encodeURIComponent(id)}/direct-messages`;
export function botDmConsent(engine: Engine, botId: string) {
  return engine.api.json("GET", path(botId), consent);
}
export function setBotDmConsent(engine: Engine, botId: string, previous: BotDmConsent, enabled: boolean) {
  return engine.api.json("PUT", path(botId), consent, { body: { enabled, rev: previous.rev, manifestRev: previous.manifestRev, noticeVersion: previous.noticeVersion } });
}
