import type { Conversation, Org } from "../api/schemas";
import { landsOnLobby, LOBBY_FEATURE } from "../sync/lobby";

export const COMMUNITY_PLACES_KEY = "meldiq.communityPlaces";
type Places = { userId: string; channels: Record<string, string> };

function places(userId: string): Places {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(COMMUNITY_PLACES_KEY) ?? "null");
    const value = raw as Partial<Places> | null;
    if (value?.userId === userId && value.channels && typeof value.channels === "object" && !Array.isArray(value.channels)) {
      return {
        userId,
        channels: Object.fromEntries(
          Object.entries(value.channels)
            .filter(([key, id]) => key.length <= 200 && typeof id === "string" && id.length <= 200)
            .slice(-200),
        ),
      };
    }
  } catch {
    /* A damaged or unavailable preference starts fresh. */
  }
  return { userId, channels: {} };
}

export function rememberCommunityChannel(userId: string, orgId: string, channelId: string): void {
  try {
    const saved = places(userId);
    saved.channels[orgId] = channelId;
    localStorage.setItem(COMMUNITY_PLACES_KEY, JSON.stringify(saved));
  } catch {
    /* Returning still falls back to the lobby or an available channel. */
  }
}

export function rememberedCommunityChannel(userId: string, orgId: string): string | null {
  return places(userId).channels[orgId] ?? null;
}

/** Explicit links keep their destination. This only selects an otherwise empty community landing view. */
export function communityLanding(
  org: Org | undefined,
  features: readonly string[],
  conversations: readonly Conversation[],
  remembered: string | null,
  synced: boolean,
): { section: "lobby" | "home"; conversationId?: string } | null {
  if (!org) return null;
  if (landsOnLobby(org, features)) return { section: "lobby" };
  const channels = conversations.filter((c) => c.type === "CHANNEL" && c.orgId === org.id && c.joined && !c.archived && !c.voice);
  const previous = channels.find((c) => c.id === remembered);
  if (previous) return { section: "home", conversationId: previous.id };
  if (org.lobby?.enabled && features.includes(LOBBY_FEATURE)) return { section: "lobby" };
  if (!synced) return null;
  const first = [...channels].sort((a, b) => (a.categoryPosition ?? 0) - (b.categoryPosition ?? 0) || a.position - b.position || a.id.localeCompare(b.id))[0];
  return first ? { section: "home", conversationId: first.id } : null;
}
