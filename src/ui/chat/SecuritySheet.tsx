import { Blocks, Info, Lock, MessageSquare, Paperclip, Phone, Server, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { shallowEqual, useEngine, useOrbit } from "../../app/orbit";
import { navigate, useRoute } from "../../app/router";
import { isRemoteUsername, type SecurityFacts, type SecurityPoint, securityPoints } from "../../sync/conversationSecurity";
import { Dialog } from "../components/Overlay";
import { dmPeer } from "../format";

/** The facts the panel shows for [conversationId]: its kind, the peer's verification, changed keys, other servers. */
function useFacts(conversationId: string): { facts: SecurityFacts; peer: { id: string; name: string } | null } | null {
  const engine = useEngine();
  const base = useOrbit(
    (s) => {
      const c = s.conversations[conversationId];
      if (!c || !s.me) return null;
      const memberIds = new Set((c.members ?? []).map((m) => m.id));
      const p = c.type === "DM" ? dmPeer(c, s.me.userId) : null;
      return {
        type: c.type,
        changedMembers: s.identityAlerts.filter((a) => memberIds.has(a.userId)).length,
        otherServers: (c.members ?? []).filter((m) => isRemoteUsername(m.username)).length,
        peer: p ? { id: p.id, name: s.users[p.id]?.displayName ?? p.displayName } : null,
      };
    },
    (a, b) => JSON.stringify(a) === JSON.stringify(b),
  );
  const [peerVerified, setPeerVerified] = useState<boolean | null>(null);
  const peerId = base?.peer?.id ?? null;
  useEffect(() => {
    if (!peerId) return;
    let alive = true;
    void engine
      .pinnedIdentity(peerId)
      .then((pin) => alive && setPeerVerified(pin?.verified ?? false))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [engine, peerId]);
  if (!base) return null;
  return { facts: { type: base.type, peerVerified: base.type === "DM" ? peerVerified === true : null, changedMembers: base.changedMembers, otherServers: base.otherServers }, peer: base.peer };
}

/** The padlock in the conversation header (android SecurityPadlock): quiet, in the warning colour when a key changed. */
export function SecurityPadlock({ conversationId }: { conversationId: string }) {
  const [open, setOpen] = useState(false);
  const attention = useOrbit((s) => {
    const ids = new Set((s.conversations[conversationId]?.members ?? []).map((m) => m.id));
    return s.identityAlerts.some((a) => ids.has(a.userId));
  }, shallowEqual);
  return (
    <>
      <button className={`icon-btn${attention ? " warn" : ""}`} onClick={() => setOpen(true)} aria-label={attention ? "Security details: a security key changed" : "Security details"} title="Security">
        {attention ? <ShieldAlert size={18} /> : <Lock size={17} />}
      </button>
      {open && <SecuritySheet conversationId={conversationId} onClose={() => setOpen(false)} />}
    </>
  );
}

const TEXT: Record<SecurityPoint, { icon: ReactNode; tone: "ok" | "warn" | "plain"; title: string; body: (who: string) => string }> = {
  keys_changed: { icon: <ShieldAlert size={18} />, tone: "warn", title: "A security key changed", body: () => "Messages with that person are paused until you check their safety number." },
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
  verified: { icon: <ShieldCheck size={18} />, tone: "ok", title: "Verified", body: (who) => `You compared safety numbers with ${who}. If their key changes, Meldiq pauses messages and tells you.` },
  not_verified: {
    icon: <ShieldQuestion size={18} />,
    tone: "plain",
    title: "Not verified yet",
    body: (who) => `Compare safety numbers with ${who} in person or on a call to make sure no one is in between.`,
  },
  verify_members: {
    icon: <ShieldQuestion size={18} />,
    tone: "plain",
    title: "Verify members one by one",
    body: () => "Open a member's details to compare safety numbers. Meldiq warns you here if anyone's key changes.",
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
function SecuritySheet({ conversationId, onClose }: { conversationId: string; onClose: () => void }) {
  const route = useRoute();
  const data = useFacts(conversationId);
  if (!data) return null;
  const who = data.peer?.name || "this person";
  const compare = data.facts.type === "DM" && !data.facts.peerVerified;
  return (
    <Dialog
      title="Security"
      onClose={onClose}
      footer={
        compare ? (
          <button
            className="btn btn-secondary"
            onClick={() => {
              onClose();
              navigate({ section: route.section, conversationId, panel: "details" });
            }}
          >
            Compare safety numbers
          </button>
        ) : undefined
      }
    >
      <div className="dialog-body">
        <ul className="security-points">
          {securityPoints(data.facts).map((p) => (
            <li key={p}>
              <span className={`security-icon ${TEXT[p].tone}`}>{TEXT[p].icon}</span>
              <span className="lines">
                <strong>{TEXT[p].title}</strong>
                <small>{TEXT[p].body(who)}</small>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}
