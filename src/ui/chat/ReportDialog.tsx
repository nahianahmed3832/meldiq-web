import { Flag, ShieldBan } from "lucide-react";
import { useState } from "react";
import { ApiError } from "../../api/client";
import { useEngine, useOrbit } from "../../application/orbit";
import type { StoredMessage } from "../../model/types";
import { goesToCommunity, REASON_LABEL, REPORT_CONTEXT, REPORT_NOTE_MAX, REPORT_REASONS, type ReportReason, reportContent, sendReport } from "../../sync/reports";
import { Dialog } from "../components/Overlay";

export type ReportTarget =
  | { kind: "message"; message: StoredMessage; conversationId: string; conversationType: string; orgName: string | null }
  | { kind: "person"; userId: string; name: string; communities: { id: string; name: string }[]; orgId?: string };

/**
 * Report a message or a person (batch B4, android ReportSheet): a reason (with "Just don't want to see them? Block"),
 * then a review step that says who reads it and exactly what's shared, an optional note, Send. Messages are end-to-end
 * encrypted, so nothing leaves this browser unless the report is sent.
 */
export function ReportDialog({ target, onBlock, onClose }: { target: ReportTarget; onBlock?: () => void; onClose: () => void }) {
  const engine = useEngine();
  const users = useOrbit((s) => s.users);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [to, setTo] = useState<string>(target.kind === "person" ? (target.orgId ?? "") : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const personName = target.kind === "person" ? target.name : (users[target.message.senderUserId]?.displayName ?? "this person");
  const community = reason ? (target.kind === "message" ? goesToCommunity(reason, target.conversationType, false) : goesToCommunity(reason, null, !!to)) : false;
  const communityName = target.kind === "message" ? target.orgName : (target.communities.find((c) => c.id === to)?.name ?? null);

  const send = async () => {
    if (!reason) return;
    setBusy(true);
    setError(null);
    try {
      let sent;
      if (target.kind === "message") {
        const m = target.message;
        const history = await engine.conversationMessages(target.conversationId, 200);
        const lines = history
          .filter((x) => x.kind === "text")
          .map((x) => ({
            id: x.id,
            senderUserId: x.senderUserId,
            text: x.text ?? "",
            sentAt: x.serverTs ?? x.sortTs,
            attachments: (x.attachments ?? []).map((a) => ({ name: a.name, size: a.size ?? null, sha256: a.sha256 ?? null })),
          }));
        const self = lines.find((l) => l.id === m.id) ?? { id: m.id, senderUserId: m.senderUserId, text: m.text ?? "", sentAt: m.serverTs ?? m.sortTs };
        sent = await sendReport(engine, { targetUserId: m.senderUserId, reason, note, conversationId: target.conversationId, messageId: m.id, content: reportContent(self, lines) });
      } else {
        sent = await sendReport(engine, { targetUserId: target.userId, reason, note, ...(to && reason !== "illegal" ? { orgId: to } : {}) });
      }
      setDone(sent.repeated ? "You already reported this message" : sent.to === "community" ? "Report sent to the moderators" : "Report sent to Meldiq's team");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't send the report.");
    } finally {
      setBusy(false);
    }
  };

  const title = target.kind === "message" ? "Report message" : `Report ${target.name}`;
  if (done)
    return (
      <Dialog title={title} onClose={onClose}>
        <div className="dialog-body">
          <div className="banner info" role="status">
            {done}
          </div>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </Dialog>
    );
  return (
    <Dialog title={title} onClose={onClose}>
      <div className="dialog-body">
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        {!reason ? (
          <>
            <h3 className="ws-subhead" style={{ marginTop: 0 }}>
              What's wrong?
            </h3>
            <div style={{ display: "grid", gap: 2 }}>
              {REPORT_REASONS.map((r) => (
                <button key={r} className="list-row" onClick={() => setReason(r)}>
                  <span className="lines">
                    <span>{REASON_LABEL[r]}</span>
                    {r === "illegal" && <small>Goes to Meldiq's team</small>}
                  </span>
                </button>
              ))}
            </div>
            {onBlock && (
              <button
                className="btn btn-ghost btn-sm"
                style={{ justifySelf: "start" }}
                onClick={() => {
                  onClose();
                  onBlock();
                }}
              >
                <ShieldBan size={14} /> Just don't want to see them? Block {personName}
              </button>
            )}
          </>
        ) : (
          <>
            <h3 className="ws-subhead" style={{ marginTop: 0 }}>
              Review your report
            </h3>
            {target.kind === "person" && target.communities.length > 0 && reason !== "illegal" && (
              <div className="field">
                <label htmlFor="rp-to">Send to</label>
                <select id="rp-to" className="input" value={to} onChange={(e) => setTo(e.target.value)}>
                  <option value="">Meldiq's team</option>
                  {target.communities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <p style={{ margin: 0 }}>
              <strong>{REASON_LABEL[reason]}.</strong> {community ? `Goes to the moderators of ${communityName ?? "the community"}. They won't see that it was you.` : "Goes to Meldiq's team."}
            </p>
            <div className="card" style={{ padding: 12, display: "grid", gap: 6 }}>
              <strong style={{ fontSize: 13 }}>What's shared</strong>
              <span className="muted" style={{ fontSize: 13 }}>
                {target.kind === "message"
                  ? `This message and up to ${REPORT_CONTEXT} messages before it, as you see them. Meldiq's moderators see them only when you send this report.`
                  : "Who you're reporting, the reason and your note."}
              </span>
              {target.kind === "message" && target.message.text && <blockquote className="report-message">{target.message.text}</blockquote>}
            </div>
            <div className="field">
              <label htmlFor="rp-note">Add details (optional)</label>
              <textarea id="rp-note" className="textarea" rows={3} maxLength={REPORT_NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setReason(null)}>
                Back
              </button>
              <button className="btn btn-danger" disabled={busy} onClick={() => void send()}>
                <Flag size={15} /> {busy ? "Sending…" : "Send report"}
              </button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
