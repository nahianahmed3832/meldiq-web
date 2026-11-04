import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
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
 * The voice-room view shows who is in it, Join voice or Open the call, and Invite people. The associated Room chat is
 * a separate view in ConversationView; opening it never invokes a call or requests microphone access.
 */
export function VoiceRoomView({ c }: { c: Conversation }) {
  useLocaleRender();
  const engine = useEngine();
  const people = useOrbit((s) => roomPeople(s, c.id), shallowEqual);
  const users = useOrbit((s) => s.users);
  const myCall = useOrbit((s) => (s.call.phase === "idle" || s.call.phase === "ended" ? null : s.call.conversationId));
  const calling = useOrbit((s) => s.server?.calling === true);
  const chatEnabled = useOrbit((s) => s.server?.features.includes("voice-channel-chat") ?? false);
  const room = voiceRoom({
    inThisRoom: myCall === c.id,
    inAnotherCall: myCall !== null && myCall !== c.id,
    canConnect: c.canConnect !== false,
    canSpeak: c.canSpeak !== false,
    callingProblem: !calling ? uiText("messaging.interface.calling_isn_t_set_up_on_this_server_56ca804") : !engine.calls.supported() ? CallFailure.UNSUPPORTED : null,
    archived: c.archived,
  });
  return (
    <div className="voice-room-page scroll" aria-label={uiText("calls.interface.voice_room_aa0cfa3")}>
      {/* Community parity A1: a stage, where listeners raise a hand and a moderator lets them speak. */}
      {c.options?.stage && (
        <div className="banner info" role="status">
          <Headphones size={16} aria-hidden />
          <span className="grow">
            {c.canSpeak === false
              ? uiText("calls.interface.this_is_a_stage_you_listen_until_a_moderator_lets_you_speak_raise_5f1c789")
              : uiText("calls.interface.this_is_a_stage_listeners_raise_a_hand_and_moderators_let_them_sp_ceb4621")}
          </span>
        </div>
      )}
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
          <h2>
            <Localized k="calls.interface.no_one_is_here_yet_0d1bb83" />
          </h2>
          <p className="muted">
            {chatEnabled ? <Localized k="workspace.voiceChat.help" /> : <Localized k="calls.interface.join_to_start_talking_voice_channels_are_for_talking_only_not_mes_8403a43" />}
          </p>
        </div>
      ) : (
        <>
          <h3 className="voice-room-label">
            <Localized k="calls.interface.in_the_room_3f71f1e" slots={[people.length]} />
          </h3>
          <ul className={`voice-room-tiles${people.length === 1 ? " single" : ""}`}>
            {people.map((id) => {
              const u = users[id];
              const name = u?.displayName ?? uiText("messaging.react_someone");
              return (
                <li key={id} className="voice-room-tile">
                  <UserAvatar userId={id} name={name} colorIndex={u?.avatarColor ?? 0} photoRev={u?.photoRev} size={64} decorative />
                  <span className="ellipsis">{id === engine.device.userId ? uiText("calls.interface.value0_you_9cd8526", { value0: name }) : name}</span>
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
              <span>
                <Localized k="calls.interface.invite_people_27bf0f2" />
              </span>
              <small>
                <Localized k="calls.interface.let_the_community_know_you_re_here_c1f440e" />
              </small>
            </span>
            <ChevronRight size={16} className="faint" aria-hidden />
          </button>
        )}
        {room.action === "open" ? (
          <button className="btn btn-primary voice-room-join" onClick={() => engine.calls.setMinimized(false)}>
            <Localized k="calls.interface.open_the_call_019f964" />
          </button>
        ) : (
          <>
            <button
              className="btn btn-primary voice-room-join"
              disabled={!room.joinEnabled}
              onClick={() => void engine.calls.startCall(c.id, false)}
              aria-describedby={room.why ? `voice-why-${c.id}` : undefined}
            >
              <Localized k="calls.interface.join_voice_201f8c4" />
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
