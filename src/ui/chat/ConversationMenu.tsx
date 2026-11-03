import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Info, Lock, MoreHorizontal, Pin, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { shallowEqual, useOrbit } from "../../application/orbit";
import { navigate, type Route } from "../../application/router";
import { Menu, type MenuEntry, useMenu } from "../components/Overlay";
import { usePinned } from "./PinnedPanel";
import { SecuritySheet } from "./SecuritySheet";
/**
 * B14 (android's minimal DM header): what used to crowd a DM's or group's header lives here: pinned messages with their
 * count, encryption, and the conversation's details. A changed security key marks the button, and
 * the banner under the header still says so.
 */
export function ConversationMenu({ conversationId, route }: { conversationId: string; route: Route }) {
  useLocaleRender();
  const menu = useMenu();
  const [security, setSecurity] = useState(false);
  const pinned = usePinned(conversationId).length;
  const attention = useOrbit((s) => {
    const ids = new Set((s.conversations[conversationId]?.members ?? []).map((m) => m.id));
    return s.identityAlerts.some((a) => ids.has(a.userId));
  }, shallowEqual);
  const panel = (p: Route["panel"]) => navigate({ section: route.section, conversationId, panel: route.panel === p ? null : p });
  const entries: MenuEntry[] = [
    { label: pinned ? uiText("messaging.interface.pinned_messages_value0_731ea09", { value0: pinned }) : uiText("messaging.conv_pins"), icon: <Pin size={16} />, onSelect: () => panel("pinned") },
    {
      label: attention ? uiText("messaging.interface.encryption_a_security_key_changed_12329be") : uiText("messaging.interface.encryption_82f4e71"),
      icon: attention ? <ShieldAlert size={16} /> : <Lock size={16} />,
      onSelect: () => setSecurity(true),
    },
    {
      get label() {
        return uiText("messaging.interface.details_media_and_files_8b5576b");
      },
      icon: <Info size={16} />,
      onSelect: () => panel("details"),
    },
  ];
  return (
    <>
      <button
        className={`icon-btn${attention ? " warn" : ""}`}
        onClick={(e) => menu.open(e.currentTarget)}
        aria-haspopup="menu"
        aria-expanded={!!menu.anchor}
        aria-label={attention ? uiText("messaging.interface.more_a_security_key_changed_4141b2a") : uiText("messaging.interface.more_d47d7cb")}
        title={uiText("messaging.interface.more_d47d7cb")}
      >
        {attention ? <ShieldAlert size={18} /> : <MoreHorizontal size={19} />}
      </button>
      {menu.anchor && <Menu anchor={menu.anchor} align="end" label={uiText("messaging.interface.conversation_ccca181")} onClose={menu.close} entries={entries} />}
      {security && <SecuritySheet conversationId={conversationId} onClose={() => setSecurity(false)} />}
    </>
  );
}
