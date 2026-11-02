import { z } from "zod";
import { openEnum } from "../api/enums";
import { PROVIDERS, type Provider, type ProfileConnection, zProfileConnection } from "../api/profileSchemas";
import type { Engine } from "./engine";

/**
 * Linked accounts (API 0.65.0 batch B, feature `connections-v2`, server docs/SETTINGS_PARITY_API.md): Steam, AniList,
 * Last.fm and Trakt on your profile. You sign in on the provider's own page, which sends the browser back to
 * /settings/profile; Meldiq keeps who you are there and a few public things. Not `/v1/connections`, which is friends.
 */

export { PROVIDERS, type Provider, type ProfileConnection };

export const PROVIDER_LABEL: Record<Provider, string> = { steam: "Steam", anilist: "AniList", lastfm: "Last.fm", trakt: "Trakt" };
/** One line on what a profile shows from each. */
export const PROVIDER_SHOWS: Record<Provider, string> = {
  steam: "Shows your Steam name and the games you played lately.",
  anilist: "Shows your AniList name and what you're watching.",
  lastfm: "Shows your Last.fm name and what you're listening to, or your top artists this month.",
  trakt: "Shows your Trakt name and the shows and films you watched lately.",
};
/** The heading over a connection's short list. */
export const ITEMS_HEADING: Record<string, string> = {
  "recently-played": "Recently played",
  watching: "Watching",
  "now-playing": "Listening now",
  "top-artists": "Top artists",
  "recently-watched": "Recently watched",
};

export const zConnectionEntry = z.object({
  provider: openEnum(PROVIDERS),
  available: z.boolean(),
  connected: z.boolean(),
  visible: z.boolean(),
  account: zProfileConnection.nullable(),
  connectedAt: z.number().nullable(),
});
export type ConnectionEntry = z.infer<typeof zConnectionEntry>;

/** The ones to draw: known providers, links that are https (the server builds them from ids; checked again here). */
export function visibleConnections(list: ProfileConnection[]): (ProfileConnection & { provider: Provider })[] {
  return list.filter((c): c is ProfileConnection & { provider: Provider } => c.provider !== "unknown" && isHttps(c.url));
}

export function isHttps(url: string | null): url is string {
  if (!url) return false;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

export type ConnectionReturn = { kind: "connected"; provider: Provider } | { kind: "error"; provider: Provider | null; code: string };

/** The provider's way back (/settings/profile?connected=steam, or ?connectionError=denied&provider=steam), or null. */
export function connectionReturn(search: string): ConnectionReturn | null {
  const q = new URLSearchParams(search);
  const known = (p: string | null): Provider | null => ((PROVIDERS as readonly string[]).includes(p ?? "") ? (p as Provider) : null);
  const connected = known(q.get("connected"));
  if (connected) return { kind: "connected", provider: connected };
  const code = q.get("connectionError");
  if (code) return { kind: "error", provider: known(q.get("provider")), code: code.slice(0, 40) };
  return null;
}

/** What a way back says, in a sentence. */
export function connectionReturnText(r: ConnectionReturn): string {
  const name = r.provider ? PROVIDER_LABEL[r.provider] : "that account";
  if (r.kind === "connected") return `${name} is connected. It shows on your profile.`;
  if (r.code === "denied") return `Connecting ${name} was cancelled on their page.`;
  if (r.code === "state") return `That sign-in expired or was already used. Try connecting ${name} again.`;
  if (r.code === "unavailable") return `${name} isn't set up on this server yet.`;
  return `${name} didn't answer properly. Try again in a moment.`;
}

export async function connections(engine: Engine): Promise<ConnectionEntry[]> {
  return (await engine.api.json("GET", "/v2/connections", z.object({ connections: z.array(zConnectionEntry) }))).connections;
}

/** The provider's sign-in page to send the browser to (works once, for 10 minutes). */
export async function startConnection(engine: Engine, provider: Provider): Promise<string> {
  return (await engine.api.json("POST", `/v2/connections/${provider}/start`, z.object({ url: z.string() }))).url;
}

export async function setConnectionVisible(engine: Engine, provider: Provider, visible: boolean): Promise<ConnectionEntry> {
  return (await engine.api.json("PUT", `/v2/connections/${provider}`, z.object({ connection: zConnectionEntry }), { body: { visible } })).connection;
}

export async function disconnect(engine: Engine, provider: Provider): Promise<ConnectionEntry> {
  return (await engine.api.json("DELETE", `/v2/connections/${provider}`, z.object({ connection: zConnectionEntry }))).connection;
}
