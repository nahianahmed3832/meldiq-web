import { useEffect } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import type { CallUiState } from "../../call/types";
import { Avatar } from "../components/Avatar";
import { GroupAvatar, UserAvatar } from "../components/OrgAvatar";

/** Call participants use the same authenticated, privacy-aware photo revision as messages and profiles. */
export function CallAvatar({ userId, name, size = 88 }: { userId: string; name: string; size?: number }) {
  const engine = useEngine();
  const user = useOrbit((s) => s.users[userId]);
  useEffect(() => {
    if (userId && !user) void engine.ensureUser(userId).catch(() => undefined);
  }, [engine, userId, user]);
  return <UserAvatar userId={userId} name={user?.displayName ?? name} colorIndex={user?.avatarColor ?? 0} photoRev={user?.photoRev} size={size} decorative />;
}

/** Before media participants arrive, identify the peer from the DM rather than drawing generic initials. */
export function CallTargetAvatar({ call, size = 96 }: { call: CallUiState; size?: number }) {
  const conversation = useOrbit((s) => (call.conversationId ? s.conversations[call.conversationId] : undefined));
  const me = useOrbit((s) => s.me?.userId);
  const peer = conversation?.type === "DM" ? conversation.members?.find((m) => m.id !== me) : null;
  if (peer) return <CallAvatar userId={peer.id} name={peer.displayName} size={size} />;
  if (conversation?.type === "GROUP") return <GroupAvatar conversationId={conversation.id} name={call.title} photoRev={conversation.photoRev ?? null} size={size} />;
  return <Avatar name={call.title} colorIndex={call.colorIndex} size={size} decorative />;
}
