import { ChevronRight, Headphones, UserPlus } from "lucide-react";
import type { Conversation } from "../../api/schemas";
import { shallowEqual, useEngine, useOrbit } from "../../application/orbit";
import { setPrefs } from "../../application/prefs";
import { navigate } from "../../application/router";
import { UserAvatar } from "../components/OrgAvatar";
import { CallFailure } from "../../call/rules";
import { roomPeople } from "../selectors";
import { voiceRoom } from "./voiceRoomRules";

/**
 * A voice channel is a room to talk in, not a chat (batch B14, android VoiceChannelScreen): who is in it (one person
 * gets the whole width, more share it two by two), Join voice or Open the call, and Invite people. No message list, no
 * composer and no message menu; the server refuses messages here too.
 */
export function VoiceRoomView({ c }: { c: Conversation }) {
  const engine = useEngine();
  const people = useOrbit((s) => roomPeople(s, c.id), shallowEqual);
  const users = useOrbit((s) => s.users);
  const myCall = useOrbit((s) => (s.call.phase === "idle" || s.call.phase === "ended" ? null : s.call.conversationId));
  const calling = useOrbit((s) => s.server?.calling === true);
  const room = voiceRoom({
    inThisRoom: myCall === c.id,
    inAnotherCall: myCall !== null && myCall !== c.id,
    canConnect: c.canConnect !== false,
    canSpeak: c.canSpeak !== false,
    callingProblem: !calling ? "Calling isn't set up on this server" : !engine.calls.supported() ? CallFailure.UNSUPPORTED : null,
    archived: c.archived,
  });

  return (
    <div className="voice-room-page scroll" aria-label="Voice room">
      {room.notice && (
        <div className="banner info" role="status">
          <Headphones size={16} aria-hidden />
          <span className="grow">{room.notice}</span>
        </div>
      )}
      {people.length === 0 ? (
        <div className="voice-room-empty">
          <span className="voice-room-orb">
            <Headphones size={40} aria-hidden />
          </span>
          <h2>No one is here yet</h2>
          <p className="muted">Join to start talking. Voice channels are for talking only, not messages.</p>
        </div>
      ) : (
        <>
          <h3 className="voice-room-label">In the room — {people.length}</h3>
          <ul className={`voice-room-tiles${people.length === 1 ? " single" : ""}`}>
            {people.map((id) => {
              const u = users[id];
              const name = u?.displayName ?? "Someone";
              return (
                <li key={id} className="voice-room-tile">
                  <UserAvatar userId={id} name={name} colorIndex={u?.avatarColor ?? 0} photoRev={u?.photoRev} size={64} decorative />
                  <span className="ellipsis">{id === engine.device.userId ? `${name} (you)` : name}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <div className="voice-room-foot">
        {c.orgId && (
          <button
            className="panel-action-row"
            onClick={() => {
              // The invitations page shows the selected community: this channel's, whichever was selected before.
              setPrefs({ orgId: c.orgId });
              navigate({ section: "workspace", workspacePage: "invitations" });
            }}
          >
            <span className="circle">
              <UserPlus size={16} />
            </span>
            <span className="lines grow">
              <span>Invite people</span>
              <small>Let the community know you're here</small>
            </span>
            <ChevronRight size={16} className="faint" aria-hidden />
          </button>
        )}
        {room.action === "open" ? (
          <button className="btn btn-primary voice-room-join" onClick={() => engine.calls.setMinimized(false)}>
            Open the call
          </button>
        ) : (
          <>
            <button
              className="btn btn-primary voice-room-join"
              disabled={!room.joinEnabled}
              onClick={() => void engine.calls.startCall(c.id, false)}
              aria-describedby={room.why ? `voice-why-${c.id}` : undefined}
            >
              Join voice
            </button>
            {room.why && (
              <small id={`voice-why-${c.id}`} className="faint" style={{ textAlign: "center" }}>
                {room.why}
              </small>
            )}
          </>
        )}
      </div>
    </div>
  );
}
