import { useEffect } from "react";
import { shallowEqual, useOrbit } from "../../application/orbit";
import { navigate, type Route } from "../../application/router";
import { landsOnLobby } from "../../sync/lobby";

/**
 * The first time someone opens a community whose lobby is shown to members, they land on it (community parity B):
 * while the community's Home is on screen and the server says the lobby hasn't been opened yet.
 */
export function useLobbyLanding(orgId: string | null, route: Route): void {
  const features = useOrbit((s) => s.server?.features ?? [], shallowEqual);
  const lands = useOrbit((s) =>
    landsOnLobby(
      s.orgs.find((o) => o.id === orgId),
      features,
    ),
  );
  const onHome = route.section === "home" && !route.conversationId;
  useEffect(() => {
    if (lands && onHome) navigate({ section: "lobby" }, true);
  }, [lands, onHome]);
}
