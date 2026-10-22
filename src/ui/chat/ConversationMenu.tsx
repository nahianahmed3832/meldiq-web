import { Info, Lock, MoreHorizontal, Pin, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { shallowEqual, useOrbit } from "../../application/orbit";
import { navigate, type Route } from "../../application/router";
import { Menu, type MenuEntry, useMenu } from "../components/Overlay";
import { usePinned } from "./PinnedPanel";
import { SecuritySheet } from "./SecuritySheet";

/**
 * B14 (android's minimal DM header): what used to crowd a DM's or group's header lives here: pinned messages with their
 * count, encryption and safety numbers, and the conversation's details. A changed security key marks the button, and
 * the banner under the header still says so.
 */
export function ConversationMenu({ conversationId, route }: { conversationId: string; route: Route }) {
  const menu = useMenu();
  const [security, setSecurity] = useState(false);
  const pinned = usePinned(conversationId).length;
  const attention = useOrbit((s) => {
    const ids = new Set((s.conversations[conversationId]?.members ?? []).map((m) => m.id));
    return s.identityAlerts.some((a) => ids.has(a.userId));
  }, shallowEqual);
  const panel = (p: Route["panel"]) => navigate({ section: route.section, conversationId, panel: route.panel === p ? null : p });
  const entries: MenuEntry[] = [
    { label: pinned ? `Pinned messages (${pinned})` : "Pinned messages", icon: <Pin size={16} />, onSelect: () => panel("pinned") },
    { label: attention ? "Encryption: a security key changed" : "Encryption and safety numbers", icon: attention ? <ShieldAlert size={16} /> : <Lock size={16} />, onSelect: () => setSecurity(true) },
    { label: "Details, media and files", icon: <Info size={16} />, onSelect: () => panel("details") },
  ];
  return (
    <>
      <button
        className={`icon-btn${attention ? " warn" : ""}`}
        onClick={(e) => menu.open(e.currentTarget)}
        aria-haspopup="menu"
        aria-expanded={!!menu.anchor}
        aria-label={attention ? "More: a security key changed" : "More"}
        title="More"
      >
        {attention ? <ShieldAlert size={18} /> : <MoreHorizontal size={19} />}
      </button>
      {menu.anchor && <Menu anchor={menu.anchor} align="end" label="Conversation" onClose={menu.close} entries={entries} />}
      {security && <SecuritySheet conversationId={conversationId} onClose={() => setSecurity(false)} />}
    </>
  );
}
