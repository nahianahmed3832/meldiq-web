import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Info, MoreHorizontal, Pin } from "lucide-react";
import { navigate, type Route } from "../../application/router";
import { Menu, type MenuEntry, useMenu } from "../components/Overlay";
import { usePinned } from "./PinnedPanel";
export function ConversationMenu({ conversationId, route }: { conversationId: string; route: Route }) {
  useLocaleRender();
  const menu = useMenu();
  const pinned = usePinned(conversationId).length;
  const panel = (p: Route["panel"]) => navigate({ section: route.section, conversationId, panel: route.panel === p ? null : p });
  const entries: MenuEntry[] = [
    { label: pinned ? uiText("messaging.interface.pinned_messages_value0_731ea09", { value0: pinned }) : uiText("messaging.conv_pins"), icon: <Pin size={16} />, onSelect: () => panel("pinned") },
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
        className="icon-btn"
        onClick={(e) => menu.open(e.currentTarget)}
        aria-haspopup="menu"
        aria-expanded={!!menu.anchor}
        aria-label={uiText("messaging.interface.more_d47d7cb")}
        title={uiText("messaging.interface.more_d47d7cb")}
      >
        <MoreHorizontal size={19} />
      </button>
      {menu.anchor && <Menu anchor={menu.anchor} align="end" label={uiText("messaging.interface.conversation_ccca181")} onClose={menu.close} entries={entries} />}
    </>
  );
}
