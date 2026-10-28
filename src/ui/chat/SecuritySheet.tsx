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

/**
 * Since API 0.57.0 (the owner's decision, 2026-10-28) Meldiq's servers store messages and files so every device gets
 * them; this sheet says so plainly, and what still protects them.
 */
const TEXT: Record<SecurityPoint, { icon: ReactNode; tone: "ok" | "warn" | "plain"; title: string; body: () => string }> = {
  keys_changed: { icon: <ShieldAlert size={18} />, tone: "warn", title: "A device key changed", body: () => "Someone in this conversation signed in on a new device." },
  messages: {
    icon: <MessageSquare size={18} />,
    tone: "plain",
    title: "Messages are stored on Meldiq's servers",
    body: () =>
      "Messages, reactions, polls and edits are kept on Meldiq's servers so every device you sign in to shows them. They travel over encrypted connections. They aren't end-to-end encrypted.",
  },
  files: {
    icon: <Paperclip size={18} />,
    tone: "plain",
    title: "Files are stored on Meldiq's servers",
    body: () => "Photos, videos, voice messages and files are kept in Meldiq's storage and sent to members over encrypted connections.",
  },
  calls_e2ee: {
    icon: <Phone size={18} />,
    tone: "ok",
    title: "Calls are encrypted in transit",
    body: () => "Call audio and video travel encrypted between each device and Meldiq's call server. Calls aren't recorded.",
  },
  other_servers: { icon: <Server size={18} />, tone: "plain", title: "Members on another server", body: () => "Their server receives the messages too, to deliver them." },
  app_updates: {
    icon: <Blocks size={18} />,
    tone: "plain",
    title: "App updates",
    body: () => "What connected apps post in this channel goes through Meldiq's server and is labelled as an app update.",
  },
  metadata: { icon: <Info size={18} />, tone: "plain", title: "Who can read them", body: () => "Members of this conversation, and Meldiq's staff when a report or the law requires it." },
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
