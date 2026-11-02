import { z } from "zod";
import type { Engine } from "./engine";

/**
 * Developer settings (API 0.65.0 batch B, server docs/SETTINGS_PARITY_API.md): "Log in with Meldiq" apps (an OAuth
 * client: its id is the client ID, its secret shown once) and bots (an account of their own that acts with a token,
 * shown once). Meldiq keeps only hashes of secrets and tokens, so a lost one is replaced, never shown again.
 */

export const APP_LIMIT = 10;
export const REDIRECT_URI_LIMIT = 10;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export const zDeveloperApp = z.object({
  id: z.string(),
  name: z.string(),
  redirectUris: z.array(z.string()),
  createdAt: z.number(),
  updatedAt: z.number(),
  secretRotatedAt: z.number(),
});
export type DeveloperApp = z.infer<typeof zDeveloperApp>;
const zAppWithSecret = z.object({ app: zDeveloperApp, clientSecret: z.string() });
export type AppWithSecret = z.infer<typeof zAppWithSecret>;

export const zDeveloperBot = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  public: z.boolean(),
  createdAt: z.number(),
  tokenRotatedAt: z.number(),
  commands: z.number(),
  communities: z.number(),
});
export type DeveloperBot = z.infer<typeof zDeveloperBot>;
const zBotWithToken = z.object({ bot: zDeveloperBot, token: z.string() });
export type BotWithToken = z.infer<typeof zBotWithToken>;
export const zBotList = z.object({ bots: z.array(zDeveloperBot), limit: z.number(), plan: z.string() });
export type BotList = z.infer<typeof zBotList>;

/** https anywhere, or http on this computer while developing; no #fragment and no user info (as the server checks). */
export function isAllowedRedirectUri(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.hash || raw.includes("#") || u.username || u.password) return false;
  if (u.protocol === "https:") return true;
  return u.protocol === "http:" && LOOPBACK_HOSTS.has(u.hostname);
}

/** Redirect URIs typed one per line: the list, or what's wrong with it. */
export function parseRedirectUris(text: string): { uris: string[] } | { problem: string } {
  const uris = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (uris.length === 0) return { problem: "Add at least one redirect URI." };
  if (uris.length > REDIRECT_URI_LIMIT) return { problem: `Up to ${REDIRECT_URI_LIMIT} redirect URIs.` };
  const bad = uris.find((u) => u.length > 500 || !isAllowedRedirectUri(u));
  if (bad) return { problem: `"${bad.slice(0, 80)}" isn't allowed: use https, or http://localhost while developing, with no #fragment.` };
  if (new Set(uris).size !== uris.length) return { problem: "Each redirect URI once." };
  return { uris };
}

// ───────────────────────── apps ─────────────────────────

export async function developerApps(engine: Engine): Promise<DeveloperApp[]> {
  return (await engine.api.json("GET", "/v2/developer/apps", z.object({ apps: z.array(zDeveloperApp), limit: z.number() }))).apps;
}

export function createApp(engine: Engine, name: string, redirectUris: string[]): Promise<AppWithSecret> {
  return engine.api.json("POST", "/v2/developer/apps", zAppWithSecret, { body: { name: name.trim(), redirectUris } });
}

export async function updateApp(engine: Engine, id: string, change: { name?: string; redirectUris?: string[] }): Promise<DeveloperApp> {
  return (await engine.api.json("PATCH", `/v2/developer/apps/${encodeURIComponent(id)}`, z.object({ app: zDeveloperApp }), { body: change })).app;
}

/** Everyone's sign-ins to it end. */
export async function deleteApp(engine: Engine, id: string): Promise<void> {
  await engine.api.call("DELETE", `/v2/developer/apps/${encodeURIComponent(id)}`);
}

/** A new client secret, shown once; the old one stops at once. */
export function rotateAppSecret(engine: Engine, id: string): Promise<AppWithSecret> {
  return engine.api.json("POST", `/v2/developer/apps/${encodeURIComponent(id)}/secret`, zAppWithSecret);
}

// ───────────────────────── bots ─────────────────────────

export function developerBots(engine: Engine): Promise<BotList> {
  return engine.api.json("GET", "/v2/developer/bots", zBotList);
}

export function createBot(engine: Engine, name: string): Promise<BotWithToken> {
  return engine.api.json("POST", "/v2/developer/bots", zBotWithToken, { body: { name: name.trim() } });
}

export async function updateBot(engine: Engine, id: string, change: { name?: string; public?: boolean }): Promise<DeveloperBot> {
  return (await engine.api.json("PATCH", `/v2/developer/bots/${encodeURIComponent(id)}`, z.object({ bot: zDeveloperBot }), { body: change })).bot;
}

/** The token stops first, then the bot leaves every community and its account goes. */
export async function deleteBot(engine: Engine, id: string): Promise<void> {
  await engine.api.call("DELETE", `/v2/developer/bots/${encodeURIComponent(id)}`);
}

/** A new token, shown once; the old one stops at once. */
export function rotateBotToken(engine: Engine, id: string): Promise<BotWithToken> {
  return engine.api.json("POST", `/v2/developer/bots/${encodeURIComponent(id)}/token`, zBotWithToken);
}
