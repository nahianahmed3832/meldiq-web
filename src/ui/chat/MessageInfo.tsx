import { useOrbit } from "../../application/orbit";
import type { MessageStatus, StoredMessage } from "../../model/types";
import { Dialog } from "../components/Overlay";
import { clock, dayLabel } from "../format";

const STATUS: Record<MessageStatus, string> = { SENDING: "Sending", SENT: "Sent", DELIVERED: "Delivered", READ: "Read", FAILED: "Not sent", RECEIVED: "Received", HELD: "Held" };

/**
 * Message info for your own message (android ConversationScreen › Message info): its status, when it was sent and
 * accepted by the relay, who it was delivered to and who read it (from receipts on this browser), and its encryption.
 */
export function MessageInfoDialog({ m, onClose }: { m: StoredMessage; onClose: () => void }) {
  const users = useOrbit((s) => s.users);
  const channel = useOrbit((s) => s.conversations[m.conversationId]?.type === "CHANNEL");
  const names = (ids: string[]) => ids.map((id) => users[id]?.displayName ?? "Someone").join(", ");
  const rows: [string, string][] = [
    ["Status", STATUS[m.status]],
    ["Sent", `${clock(m.sentAt)} · ${dayLabel(m.sentAt)}`],
    ...(m.serverTs ? [["Accepted by relay", clock(m.serverTs)] as [string, string]] : []),
    ["Delivered to", names(m.deliveredTo) || (channel ? "Receipts aren't collected in channels" : "Not yet")],
    ["Read by", names(m.readBy) || (channel ? "Receipts aren't collected in channels" : "Not yet")],
    ["Encryption", "griip-envelope-v1 · signed by this account's device"],
  ];
  return (
    <Dialog title="Message info" onClose={onClose}>
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
