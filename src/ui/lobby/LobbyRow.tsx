import { House } from "lucide-react";
import { shallowEqual, useOrbit } from "../../application/orbit";
import { navigate } from "../../application/router";
import { offersLobby } from "../../sync/lobby";

/**
 * The first row of a community's channel list (above Invite people): its lobby. Members see it while the lobby is
 * shown to them; people who can edit it always do, with a note while it's hidden.
 */
export function LobbyRow({ orgId, canEdit, current }: { orgId: string; canEdit: boolean; current: boolean }) {
  const features = useOrbit((s) => s.server?.features ?? [], shallowEqual);
  const lobby = useOrbit((s) => s.orgs.find((o) => o.id === orgId)?.lobby ?? null, shallowEqual);
  if (!offersLobby({ lobby }, features, canEdit)) return null;
  return (
    <div className="lobby-entry">
      <button className="side-item lobby-row" aria-current={current ? "page" : undefined} onClick={() => navigate({ section: "lobby" })}>
        <span className="glyph">
          <House size={17} />
        </span>
        <span className="grow">Lobby</span>
        {!lobby?.enabled && <small className="lobby-row-note">Hidden</small>}
      </button>
    </div>
  );
}
