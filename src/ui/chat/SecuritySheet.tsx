import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { useT as useLocalization } from "../../i18n";
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
const TEXT: Record<
  SecurityPoint,
  {
    icon: ReactNode;
    tone: "ok" | "warn" | "plain";
    title: string;
    body: () => string;
  }
> = {
  keys_changed: {
    icon: <ShieldAlert size={18} />,
    tone: "warn",
    get title() {
      return uiText("messaging.interface.a_device_key_changed_b56c906");
    },
    body: () => uiText("messaging.interface.someone_in_this_conversation_signed_in_on_a_new_device_2ae002b"),
  },
  messages: {
    icon: <MessageSquare size={18} />,
    tone: "plain",
    get title() {
      return uiText("messaging.interface.messages_are_stored_on_meldiq_s_servers_87b4e0f");
    },
    body: () => uiText("messaging.interface.messages_reactions_polls_and_edits_are_kept_on_meldiq_s_servers_s_7eaa004"),
  },
  files: {
    icon: <Paperclip size={18} />,
    tone: "plain",
    get title() {
      return uiText("messaging.interface.files_are_stored_on_meldiq_s_servers_31f3e46");
    },
    body: () => uiText("messaging.interface.photos_videos_voice_messages_and_files_are_kept_in_meldiq_s_stora_29625bb"),
  },
  calls_e2ee: {
    icon: <Phone size={18} />,
    tone: "ok",
    get title() {
      return uiText("messaging.interface.check_call_encryption_a80bd8c");
    },
    body: () => uiText("messaging.interface.the_call_s_security_badge_shows_whether_audio_video_and_screen_sh_a4fdf95"),
  },
  other_servers: {
    icon: <Server size={18} />,
    tone: "plain",
    get title() {
      return uiText("messaging.interface.members_on_another_server_6da0ec3");
    },
    body: () => uiText("messaging.interface.their_server_receives_the_messages_too_to_deliver_them_b2d835d"),
  },
  app_updates: {
    icon: <Blocks size={18} />,
    tone: "plain",
    get title() {
      return uiText("messaging.interface.app_updates_5808dea");
    },
    body: () => uiText("messaging.interface.what_connected_apps_post_in_this_channel_goes_through_meldiq_s_se_f4c92a4"),
  },
  metadata: {
    icon: <Info size={18} />,
    tone: "plain",
    get title() {
      return uiText("messaging.interface.who_can_read_them_d1cc0c2");
    },
    body: () => uiText("messaging.interface.conversation_members_can_read_them_meldiq_s_servers_store_message_0c7a351"),
  },
};
/** What protects this conversation, and what doesn't (android ConversationSecuritySheet). */
export function SecuritySheet({ conversationId, onClose }: { conversationId: string; onClose: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const facts = useFacts(conversationId);
  if (!facts) return null;
  return (
    <Dialog title={l10n("settings.security")} onClose={onClose}>
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
