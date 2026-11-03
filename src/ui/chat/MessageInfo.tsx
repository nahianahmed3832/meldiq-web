import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { useT as useLocalization } from "../../i18n";
import { useOrbit } from "../../application/orbit";
import type { MessageStatus, StoredMessage } from "../../model/types";
import { Dialog } from "../components/Overlay";
import { clock, dayLabel } from "../format";
const STATUS: Record<MessageStatus, string> = {
  get SENDING() {
    return uiText("messaging.interface.sending_e595f17");
  },
  get SENT() {
    return uiText("messaging.interface.sent_c16bc82");
  },
  get DELIVERED() {
    return uiText("messaging.interface.delivered_9061156");
  },
  get READ() {
    return uiText("messaging.interface.read_9b9a8d0");
  },
  get FAILED() {
    return uiText("messaging.interface.not_sent_cd5f943");
  },
  get RECEIVED() {
    return uiText("messaging.interface.received_49f19be");
  },
  get HELD() {
    return uiText("messaging.interface.held_85cd61f");
  },
};
/**
 * Message info for your own message (android ConversationScreen › Message info): its status, when it was sent and
 * accepted by the relay, who it was delivered to and who read it (from receipts on this browser), and its encryption.
 */
export function MessageInfoDialog({ m, onClose }: { m: StoredMessage; onClose: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const users = useOrbit((s) => s.users);
  const channel = useOrbit((s) => s.conversations[m.conversationId]?.type === "CHANNEL");
  const names = (ids: string[]) => ids.map((id) => users[id]?.displayName ?? uiText("messaging.react_someone")).join(", ");
  const rows: [string, string][] = [
    [uiText("billing.interface.status_920e413"), STATUS[m.status]],
    [uiText("messaging.interface.sent_c16bc82"), `${clock(m.sentAt)} · ${dayLabel(m.sentAt)}`],
    ...(m.serverTs ? [[uiText("messaging.interface.accepted_by_relay_9113e41"), clock(m.serverTs)] as [string, string]] : []),
    [
      uiText("messaging.interface.delivered_to_d2b095c"),
      names(m.deliveredTo) || (channel ? uiText("messaging.interface.receipts_aren_t_collected_in_channels_ec09359") : uiText("messaging.interface.not_yet_a9549d7")),
    ],
    [
      uiText("messaging.interface.read_by_d90fe2d"),
      names(m.readBy) || (channel ? uiText("messaging.interface.receipts_aren_t_collected_in_channels_ec09359") : uiText("messaging.interface.not_yet_a9549d7")),
    ],
    [uiText("messaging.interface.encryption_82f4e71"), uiText("messaging.interface.griip_envelope_v1_signed_by_this_account_s_device_6c82443")],
  ];
  return (
    <Dialog title={l10n("messaging.msg_info")} onClose={onClose}>
      <dl className="info-list dialog-body">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
