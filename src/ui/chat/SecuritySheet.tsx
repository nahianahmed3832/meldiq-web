import { Blocks, Info, MessageSquare, Paperclip, Phone, Server, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useOrbit } from "../../application/orbit";
import { isRemoteUsername, type SecurityFacts, type SecurityPoint, securityPoints } from "../../sync/conversationSecurity";
import { Dialog } from "../components/Overlay";

/** The facts the panel shows for [conversationId]: its kind, changed keys, other servers. */
function useFacts(conversationId: string): SecurityFacts | null {
  return useOrbit(
    (s) => {
      const c = s.conversations[conversationId];
      if (!c || !s.me) return null;
      const memberIds = new Set((c.members ?? []).map((m) => m.id));
      return {
        type: c.type,
        changedMembers: s.identityAlerts.filter((a) => memberIds.has(a.userId)).length,
        otherServers: (c.members ?? []).filter((m) => isRemoteUsername(m.username)).length,
      };
    },
    (a, b) => JSON.stringify(a) === JSON.stringify(b),
  );
}

const TEXT: Record<SecurityPoint, { icon: ReactNode; tone: "ok" | "warn" | "plain"; title: string; body: () => string }> = {
  keys_changed: { icon: <ShieldAlert size={18} />, tone: "warn", title: "A security key changed", body: () => "Messages with that person are paused until you review the change." },
  messages: {
    icon: <MessageSquare size={18} />,
    tone: "ok",
    title: "Messages are end-to-end encrypted",
    body: () => "Messages, reactions, polls and edits are encrypted in this browser for each member's devices. Meldiq's server only relays and stores encrypted copies.",
  },
  files: {
    icon: <Paperclip size={18} />,
    tone: "ok",
    title: "Files are encrypted before upload",
    body: () => "Photos, videos, voice messages and files are encrypted in this browser; the server can't open them or scan them.",
  },
  calls_e2ee: {
    icon: <Phone size={18} />,
    tone: "ok",
    title: "Calls are end-to-end encrypted",
    body: () => "Call audio and video use a key only the participants have. The call screen confirms it once media is decrypting; without the key, this browser doesn't join.",
  },
  other_servers: { icon: <Server size={18} />, tone: "plain", title: "Members on another server", body: () => "Both servers relay encrypted copies only, kept for at most 7 days until delivered." },
  app_updates: {
    icon: <Blocks size={18} />,
    tone: "warn",
    title: "App updates aren't end-to-end encrypted",
    body: () => "What connected apps post in this channel goes through Meldiq's server and is labelled as an app update.",
  },
  metadata: { icon: <Info size={18} />, tone: "plain", title: "What the server can see", body: () => "Who is in this conversation, when messages are sent and how large they are. Not their content." },
};

/** What protects this conversation, and what doesn't (android ConversationSecuritySheet). */
export function SecuritySheet({ conversationId, onClose }: { conversationId: string; onClose: () => void }) {
  const facts = useFacts(conversationId);
  if (!facts) return null;
  return (
    <Dialog title="Security" onClose={onClose}>
      <div className="dialog-body">
        <ul className="security-points">
          {securityPoints(facts).map((p) => (
            <li key={p}>
              <span className={`security-icon ${TEXT[p].tone}`}>{TEXT[p].icon}</span>
              <span className="lines">
                <strong>{TEXT[p].title}</strong>
                <small>{TEXT[p].body()}</small>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}
