import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Headphones } from "lucide-react";
import { shallowEqual, useEngine, useOrbit } from "../../application/orbit";
import { navigate } from "../../application/router";
import { UserAvatar } from "../components/OrgAvatar";
import { roomPeople, voiceRooms } from "../selectors";
import { Collapsible } from "./SidebarSections";
const MAX_FACES = 5;
/**
 * Home › Voice rooms (docs/VOICE_ROOMS.md; android VoiceRooms): the workspace's voice rooms, who is in each now, and
 * Join, which starts the room's call or joins the open one. Nobody is rung.
 */
export function VoiceRoomsSection({ orgId }: { orgId: string | null }) {
  useLocaleRender();
  const ids = useOrbit((s) => voiceRooms(s, orgId).map((c) => c.id), shallowEqual);
  if (ids.length === 0) return null;
  return (
    <Collapsible id="::voice-rooms" title={uiText("calls.interface.voice_rooms_243b434")}>
      {ids.map((id) => (
        <VoiceRoomRow key={id} id={id} />
      ))}
    </Collapsible>
  );
}
function VoiceRoomRow({ id }: { id: string }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const name = useOrbit((s) => s.conversations[id]?.name ?? uiText("calls.interface.voice_room_aa0cfa3"));
  const people = useOrbit((s) => roomPeople(s, id), shallowEqual);
  const users = useOrbit((s) => s.users);
  const busy = useOrbit((s) => s.call.phase !== "idle" && s.call.phase !== "ended");
  const canCall = useOrbit((s) => s.server?.calling === true) && engine.calls.supported();
  const live = people.length > 0;
  return (
    <div className="side-item voice-room">
      <span className={`glyph${live ? " live" : ""}`}>
        <Headphones size={16} />
      </span>
      <button className="grow voice-room-name" onClick={() => navigate({ section: "home", conversationId: id })}>
        <span className="ellipsis">{name}</span>
        {live ? (
          <span className="voice-room-people" aria-label={uiText("calls.interface.value0_in_the_room_b52a116", { value0: people.length })}>
            {people.slice(0, MAX_FACES).map((u) => (
              <UserAvatar
                key={u}
                userId={u}
                name={users[u]?.displayName ?? uiText("messaging.react_someone")}
                colorIndex={users[u]?.avatarColor ?? 0}
                photoRev={users[u]?.photoRev}
                size={18}
                decorative
              />
            ))}
            <span className="here">
              <Localized k="calls.interface.here_73605a2" slots={[people.length]} />
            </span>
          </span>
        ) : (
          <span className="voice-room-empty">
            <Localized k="calls.interface.nobody_s_here_996d944" />
          </span>
        )}
      </button>
      {canCall && (
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => void engine.calls.startCall(id, false)}
          disabled={busy}
          aria-label={uiText("workspace.interface.join_value0_81fbd12", { value0: name })}
        >
          {l10n("workspace.discover_join")}
        </button>
      )}
    </div>
  );
}
