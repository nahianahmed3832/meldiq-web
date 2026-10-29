import { ApiError } from "../api/client";
import {
  type LobbyFeedInfo,
  type LobbySettingsView,
  type LobbyTemplateKey,
  type LobbyView,
  zLobbyFeedCreated,
  zLobbyFeedDeleted,
  zLobbySeen,
  zLobbySettingsView,
  zLobbyView,
} from "../api/lobbySchemas";
import type { Org } from "../api/schemas";
import type { LobbySettingsBody } from "./lobbyDraft";
import type { Engine } from "./engine";

/**
 * A community's lobby (community parity B; server docs/COMMUNITY_PARITY_API.md › Lobby): the front page members land on
 * the first time they open the community, laid out by the community's own look and card order. The community guide
 * (sync/guide.ts) stays as it is and shows as one of its cards.
 */
export const LOBBY_FEATURE = "community-lobby";

const enc = encodeURIComponent;
const base = (orgId: string) => `/v1/orgs/${enc(orgId)}/lobby`;

/** The lobby as this account sees it. */
export function lobbyView(engine: Engine, orgId: string): Promise<LobbyView> {
  return engine.api.json("GET", base(orgId), zLobbyView);
}

/** The lobby's settings, revision and (for editors) the feed URL's state. */
export function lobbySettings(engine: Engine, orgId: string): Promise<LobbySettingsView> {
  return engine.api.json("GET", `${base(orgId)}/settings`, zLobbySettingsView);
}

/** Thrown when someone else saved the lobby since this draft was loaded (409 lobby_stale). */
export class LobbyStale extends Error {
  constructor() {
    super("Someone else changed the lobby while you were editing. Their version is loaded now; make your changes again.");
    this.name = "LobbyStale";
  }
}

const stale = (e: unknown): never => {
  if (e instanceof ApiError && e.code === "lobby_stale") throw new LobbyStale();
  throw e;
};

/** Saves a change made on revision [body.rev]; fields left out stay. */
export async function saveLobby(engine: Engine, orgId: string, body: LobbySettingsBody): Promise<LobbySettingsView> {
  const view = await engine.api.json("PUT", `${base(orgId)}/settings`, zLobbySettingsView, { body }).catch(stale);
  void engine.refreshAll();
  return view;
}

/** Applies a template's look and layout (saved at once); text, channels and buttons stay. */
export function applyLobbyTemplate(engine: Engine, orgId: string, key: LobbyTemplateKey, rev: number): Promise<LobbySettingsView> {
  return engine.api.json("POST", `${base(orgId)}/template`, zLobbySettingsView, { body: { key, rev } }).catch(stale);
}

/** Communities whose lobby this account opened in this tab (the org list says so only after its next refresh). */
const seenHere = new Set<string>();

/** This account has opened the lobby: the app stops opening it first. */
export async function markLobbySeen(engine: Engine, orgId: string): Promise<void> {
  seenHere.add(orgId);
  await engine.api.json("POST", `${base(orgId)}/seen`, zLobbySeen);
}

/** Whether opening [org] should land on its lobby: the server has it, it's shown to members, and it's never been opened. */
export function landsOnLobby(org: Pick<Org, "id" | "lobby"> | null | undefined, features: readonly string[]): boolean {
  return !!org?.lobby && features.includes(LOBBY_FEATURE) && org.lobby.enabled && !org.lobby.seen && !seenHere.has(org.id);
}

/** Whether the channel list offers the lobby: on for members, or always for people who can set it up. */
export function offersLobby(org: Pick<Org, "lobby"> | null | undefined, features: readonly string[], canEdit: boolean): boolean {
  return features.includes(LOBBY_FEATURE) && !!org && (canEdit || !!org.lobby?.enabled);
}

/** A new or replaced feed URL: the token is shown only now. */
export async function createLobbyFeed(engine: Engine, orgId: string): Promise<{ url: string; feed: LobbyFeedInfo }> {
  const created = await engine.api.json("POST", `${base(orgId)}/feed`, zLobbyFeedCreated);
  return { url: lobbyFeedUrl(engine.api.base || location.origin, created.token), feed: created.feed };
}

export async function deleteLobbyFeed(engine: Engine, orgId: string): Promise<void> {
  await engine.api.json("DELETE", `${base(orgId)}/feed`, zLobbyFeedDeleted);
}

/** Where apps post to the lobby's feed: `<API base>/v1/lobby-feed/<token>`. */
export function lobbyFeedUrl(apiBase: string, token: string): string {
  return `${apiBase.replace(/\/+$/, "")}/v1/lobby-feed/${enc(token)}`;
}
