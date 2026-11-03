import { text as uiText } from "../i18n";
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
export const PROVIDER_LABEL: Record<Provider, string> = {
  steam: "Steam",
  anilist: "AniList",
  lastfm: "Last.fm",
  trakt: "Trakt",
};
/** One line on what a profile shows from each. */
export const PROVIDER_SHOWS: Record<Provider, string> = {
  get steam() {
    return uiText("workspace.interface.shows_your_steam_name_and_the_games_you_played_lately_ecaaa14");
  },
  get anilist() {
    return uiText("workspace.interface.shows_your_anilist_name_and_what_you_re_watching_63d8628");
  },
  get lastfm() {
    return uiText("workspace.interface.shows_your_last_fm_name_and_what_you_re_listening_to_or_your_top_8067ac6");
  },
  get trakt() {
    return uiText("workspace.interface.shows_your_trakt_name_and_the_shows_and_films_you_watched_lately_56410fb");
  },
};
/** The heading over a connection's short list. */
export const ITEMS_HEADING: Record<string, string> = {
  get "recently-played"() {
    return uiText("workspace.interface.recently_played_452ec9f");
  },
  get watching() {
    return uiText("calls.interface.watching_fbc5940");
  },
  get "now-playing"() {
    return uiText("workspace.interface.listening_now_a95738c");
  },
  get "top-artists"() {
    return uiText("workspace.interface.top_artists_5c6b3cf");
  },
  get "recently-watched"() {
    return uiText("workspace.interface.recently_watched_eb33c39");
  },
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
export function visibleConnections(list: ProfileConnection[]): (ProfileConnection & {
  provider: Provider;
})[] {
  return list.filter(
    (
      c,
    ): c is ProfileConnection & {
      provider: Provider;
    } => c.provider !== "unknown" && isHttps(c.url),
  );
}
export function isHttps(url: string | null): url is string {
  if (!url) return false;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}
export type ConnectionReturn =
  | {
      kind: "connected";
      provider: Provider;
    }
  | {
      kind: "error";
      provider: Provider | null;
      code: string;
    };
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
  const name = r.provider ? PROVIDER_LABEL[r.provider] : uiText("workspace.interface.that_account_1511a48");
  if (r.kind === "connected") return uiText("workspace.interface.value0_is_connected_it_shows_on_your_profile_5f13603", { value0: name });
  if (r.code === "denied") return uiText("workspace.interface.connecting_value0_was_cancelled_on_their_page_90192d1", { value0: name });
  if (r.code === "state") return uiText("workspace.interface.that_sign_in_expired_or_was_already_used_try_connecting_value0_ag_0a081e5", { value0: name });
  if (r.code === "unavailable") return uiText("workspace.interface.value0_isn_t_set_up_on_this_server_yet_cfd0c9b", { value0: name });
  return uiText("workspace.interface.value0_didn_t_answer_properly_try_again_in_a_moment_0a71c9f", { value0: name });
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
