import { Headphones } from "lucide-react";
import { shallowEqual, useEngine, useOrbit } from "../../app/orbit";
import { roomPeople } from "../selectors";

/** A voice room's banner (android ConversationScreen): who's in it now, and Join, which opens it when nobody is there. */
export function VoiceRoomBanner({ conversationId, canJoin }: { conversationId: string; canJoin: boolean }) {
  const engine = useEngine();
  const people = useOrbit((s) => roomPeople(s, conversationId), shallowEqual);
  const names = useOrbit((s) => people.slice(0, 3).map((u) => s.users[u]?.displayName ?? "Someone"), shallowEqual);
  const here = people.length;
  const text =
    here === 0
      ? "Nobody's in this voice room yet. Join to open it; nobody is rung."
      : `${names.join(", ")}${here > names.length ? ` and ${here - names.length} more` : ""} ${here === 1 ? "is" : "are"} in the room.`;
  return (
    <div className={`banner ${here > 0 ? "ok" : "info"} call-banner`}>
      <Headphones size={16} />
      <span className="grow">{text}</span>
      {canJoin && (
        <button className="btn btn-secondary btn-sm" onClick={() => void engine.calls.startCall(conversationId, false)}>
          Join
        </button>
      )}
    </div>
  );
}
