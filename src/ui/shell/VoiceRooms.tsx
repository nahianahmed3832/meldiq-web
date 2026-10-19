import { Headphones } from "lucide-react";
import { shallowEqual, useEngine, useOrbit } from "../../app/orbit";
import { navigate } from "../../app/router";
import { UserAvatar } from "../components/OrgAvatar";
import { roomPeople, voiceRooms } from "../selectors";
import { Collapsible } from "./SidebarSections";

const MAX_FACES = 5;

/**
 * Home › Voice rooms (docs/VOICE_ROOMS.md; android VoiceRooms): the workspace's voice rooms, who is in each now, and
 * Join, which starts the room's call or joins the open one. Nobody is rung.
 */
export function VoiceRoomsSection({ orgId }: { orgId: string | null }) {
  const ids = useOrbit((s) => voiceRooms(s, orgId).map((c) => c.id), shallowEqual);
  if (ids.length === 0) return null;
  return (
    <Collapsible id="::voice-rooms" title="Voice rooms">
      {ids.map((id) => (
        <VoiceRoomRow key={id} id={id} />
      ))}
    </Collapsible>
  );
}

function VoiceRoomRow({ id }: { id: string }) {
  const engine = useEngine();
  const name = useOrbit((s) => s.conversations[id]?.name ?? "Voice room");
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
          <span className="voice-room-people" aria-label={`${people.length} in the room`}>
            {people.slice(0, MAX_FACES).map((u) => (
              <UserAvatar key={u} userId={u} name={users[u]?.displayName ?? "Someone"} colorIndex={users[u]?.avatarColor ?? 0} photoRev={users[u]?.photoRev} size={18} decorative />
            ))}
            <span className="here">{people.length} here</span>
          </span>
        ) : (
          <span className="voice-room-empty">Nobody's here</span>
        )}
      </button>
      {canCall && (
        <button className="btn btn-secondary btn-sm" onClick={() => void engine.calls.startCall(id, false)} disabled={busy} aria-label={`Join ${name}`}>
          Join
        </button>
      )}
    </div>
  );
}
