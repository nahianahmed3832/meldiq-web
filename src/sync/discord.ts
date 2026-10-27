import { z } from "zod";
import type { Engine } from "./engine";

/**
 * Importing a Discord server's structure (API 0.43.0, meldiq docs/DISCORD_IMPORT.md): connect with Discord, preview,
 * import into a new or existing community, follow its progress, retry. Only structure ever moves: never messages,
 * members or DMs. Discord tokens never reach the browser; the server keeps none either.
 */
const enc = encodeURIComponent;

export const zConnection = z.object({ id: z.string(), guildId: z.string(), guildName: z.string(), verifiedAt: z.number(), expiresAt: z.number() });
export type DiscordConnection = z.infer<typeof zConnection>;

const zStatus = z.object({ configured: z.boolean(), connections: z.array(zConnection) });
const zItemKind = z.enum(["icon", "role", "category", "channel", "emoji"]);
const zPreviewItem = z.object({ key: z.string(), kind: zItemKind, name: z.string(), action: z.enum(["create", "skip"]), note: z.string().nullable() });
const zPreview = z.object({ guild: z.object({ id: z.string(), name: z.string(), description: z.string().nullable() }), items: z.array(zPreviewItem), excluded: z.array(z.string()) });
export const zImportOptions = z.object({ icon: z.boolean(), roles: z.boolean(), rolePermissions: z.boolean(), channels: z.boolean(), emojis: z.boolean() });
export const zImportView = z.object({
  id: z.string(),
  guildId: z.string(),
  guildName: z.string(),
  orgId: z.string().nullable(),
  status: z.enum(["running", "completed", "completed_with_errors", "failed", "interrupted"]),
  error: z.string().nullable(),
  options: zImportOptions,
  counts: z.object({ total: z.number(), done: z.number(), failed: z.number(), skipped: z.number(), pending: z.number() }),
  createdAt: z.number(),
  finishedAt: z.number().nullable(),
});
const zImportItem = z.object({ key: z.string(), kind: zItemKind, name: z.string(), status: z.enum(["pending", "done", "failed", "skipped"]), note: z.string().nullable() });

export type DiscordItemKind = z.infer<typeof zItemKind>;
export type DiscordPreview = z.infer<typeof zPreview>;
export type DiscordImportOptions = z.infer<typeof zImportOptions>;
export type DiscordImport = z.infer<typeof zImportView>;
export type DiscordImportItem = z.infer<typeof zImportItem>;
export type DiscordDestination = { orgId: string } | { name: string };

export const discordStatus = (engine: Engine) => engine.api.json("GET", "/v1/discord/status", zStatus);

/** Where to add Meldiq's bot (Discord's own page); the browser goes there and comes back to /discord/callback. */
export const discordConnectUrl = async (engine: Engine): Promise<string> => (await engine.api.json("POST", "/v1/discord/connect", z.object({ url: z.string().url() }))).url;

export const finishDiscordConnect = async (engine: Engine, ret: { code: string; state: string; guildId: string | null }): Promise<DiscordConnection> =>
  (await engine.api.json("POST", "/v1/discord/callback", z.object({ connection: zConnection }), { body: { code: ret.code, state: ret.state, ...(ret.guildId ? { guildId: ret.guildId } : {}) } }))
    .connection;

export const disconnectDiscord = (engine: Engine, id: string, leave: boolean) =>
  engine.api.json("DELETE", `/v1/discord/connections/${enc(id)}${leave ? "?leave=true" : ""}`, z.object({ ok: z.literal(true), botLeft: z.boolean() }));

export const discordPreview = (engine: Engine, connectionId: string, orgId: string | null) =>
  engine.api.json("GET", `/v1/discord/connections/${enc(connectionId)}/preview${orgId ? `?orgId=${enc(orgId)}` : ""}`, zPreview);

export const startDiscordImport = async (engine: Engine, connectionId: string, destination: DiscordDestination, options: DiscordImportOptions): Promise<DiscordImport> =>
  (await engine.api.json("POST", "/v1/discord/imports", z.object({ import: zImportView }), { body: { connectionId, destination, options } })).import;

export const discordImport = (engine: Engine, id: string) => engine.api.json("GET", `/v1/discord/imports/${enc(id)}`, z.object({ import: zImportView, items: z.array(zImportItem) }));

export const retryDiscordImport = async (engine: Engine, id: string): Promise<DiscordImport> =>
  (await engine.api.json("POST", `/v1/discord/imports/${enc(id)}/retry`, z.object({ import: zImportView }))).import;

/** Only what the chosen parts would make, from a preview of everything. */
export function previewFor(items: DiscordPreview["items"], options: DiscordImportOptions): DiscordPreview["items"] {
  const on: Record<DiscordItemKind, boolean> = { icon: options.icon, role: options.roles, category: options.channels, channel: options.channels, emoji: options.emojis };
  return items.filter((i) => on[i.kind]);
}

/** Done once nothing is still to be made. */
export const importFinished = (imp: DiscordImport): boolean => imp.status !== "running";
