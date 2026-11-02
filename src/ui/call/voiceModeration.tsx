import { MicOff, Mic, PhoneOff, UserCheck, UserMinus } from "lucide-react";
import { useEngine, useOrbit } from "../../application/orbit";
import type { CallParticipantView, CallUiState } from "../../call/types";
import { PARITY_FEATURES, setStageSpeaker } from "../../sync/communityParity";
import { disconnectVoice, setVoiceMute } from "../../sync/communitySafety";
import type { MenuEntry } from "../components/Overlay";
import { useCommunityAccess, useFeature } from "../community/useCommunityAccess";

export interface VoiceModeration {
  /** The room is a stage (community parity A1). */
  stage: boolean;
  /** Who may speak on the stage (its moderators see it). */
  speakerIds: readonly string[];
  /** Whether this person moderates the stage (let speak, back to the audience). */
  stageModerator: boolean;
  /** The extra menu entries for [p]: stage, server mute and disconnect (community parity A1–A2). */
  entriesFor: (p: CallParticipantView) => MenuEntry[];
}

/**
 * Community voice moderation in a call's people list: on a stage, letting someone speak or sending them back to the
 * audience; with voice.mute_members a server mute (every voice channel of the community, until unmuted); with
 * voice.move_members taking them out of the call. The server checks every action again.
 */
export function useVoiceModeration(call: CallUiState): VoiceModeration {
  const engine = useEngine();
  const conv = useOrbit((s) => (call.conversationId ? s.conversations[call.conversationId] : undefined));
  const orgId = conv?.type === "CHANNEL" ? conv.orgId : null;
  const access = useCommunityAccess(orgId);
  const safety = useFeature(PARITY_FEATURES.safety);
  const stage = !!conv?.options?.stage;
  const speakerIds = conv?.options?.speakerIds ?? [];
  const holds = (key: string) => !!access && (access.isOwner || access.effective.includes(key));
  const stageModerator = stage && (call.canModerate || !!conv?.canManage);
  const fail = (what: string) => () => engine.notice("error", `Couldn't ${what}. Try again.`);
  const entriesFor = (p: CallParticipantView): MenuEntry[] => {
    if (p.isLocal || !conv || !orgId) return [];
    const entries: MenuEntry[] = [];
    if (stageModerator) {
      const speaking = speakerIds.includes(p.userId);
      entries.push({
        label: speaking ? "Move to audience" : "Let them speak",
        icon: speaking ? <UserMinus size={16} /> : <UserCheck size={16} />,
        onSelect: () =>
          void setStageSpeaker(engine, conv.id, p.userId, !speaking)
            .then(() => engine.community.refresh(orgId))
            .catch(fail(speaking ? "move them to the audience" : "let them speak")),
      });
    }
    if (safety && holds("voice.mute_members")) {
      entries.push(
        { label: "Server mute", icon: <MicOff size={16} />, onSelect: () => void setVoiceMute(engine, orgId, p.userId, true).catch(fail("mute them")) },
        { label: "Server unmute", icon: <Mic size={16} />, onSelect: () => void setVoiceMute(engine, orgId, p.userId, false).catch(fail("unmute them")) },
      );
    }
    if (safety && holds("voice.move_members"))
      entries.push({ label: "Disconnect", icon: <PhoneOff size={16} />, danger: true, onSelect: () => void disconnectVoice(engine, orgId, p.userId).catch(fail("disconnect them")) });
    return entries;
  };
  return { stage, speakerIds, stageModerator, entriesFor };
}
