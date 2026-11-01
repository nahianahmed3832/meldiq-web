import { useEffect, useLayoutEffect } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate, type Route } from "../../application/router";
import { communityLanding, rememberCommunityChannel, rememberedCommunityChannel } from "../../application/communityLanding";
import { landsOnLobby } from "../../sync/lobby";

/** Desktop entries reopen a channel or lobby; phones retain their channel-list back navigation. */
export function useLobbyLanding(orgId: string | null, route: Route, phone = false): void {
  const engine = useEngine();
  const features = useOrbit((s) => s.server?.features);
  const org = useOrbit((s) => s.orgs.find((o) => o.id === orgId));
  const conversations = useOrbit((s) => s.conversations);
  const synced = useOrbit((s) => s.synced);
  const selected = route.conversationId ? conversations[route.conversationId] : null;
  useEffect(() => {
    if (selected?.type === "CHANNEL" && selected.orgId && !selected.voice && !selected.archived) rememberCommunityChannel(engine.device.userId, selected.orgId, selected.id);
  }, [engine, selected]);
  useLayoutEffect(() => {
    if (route.section !== "home" || route.conversationId || !orgId || !features) return;
    if (phone && !landsOnLobby(org, features)) return;
    const target = communityLanding(org, features, Object.values(conversations), rememberedCommunityChannel(engine.device.userId, orgId), synced);
    if (target) navigate(target, true);
  }, [engine, orgId, org, features, conversations, synced, route.section, route.conversationId, phone]);
}
