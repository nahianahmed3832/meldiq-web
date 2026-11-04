import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Flag, ShieldBan } from "lucide-react";
import { useState } from "react";
import { ApiError } from "../../api/client";
import { useEngine, useOrbit } from "../../application/orbit";
import type { StoredMessage } from "../../model/types";
import { goesToCommunity, REASON_LABEL, REPORT_CONTEXT, REPORT_NOTE_MAX, REPORT_REASONS, type ReportReason, reportContent, sendReport, sendCommunityReport } from "../../sync/reports";
import { Dialog } from "../components/Overlay";
export type ReportTarget =
  | { kind: "community"; orgId: string; name: string }
  | {
      kind: "message";
      message: StoredMessage;
      conversationId: string;
      conversationType: string;
      orgName: string | null;
    }
  | {
      kind: "person";
      userId: string;
      name: string;
      communities: {
        id: string;
        name: string;
      }[];
      orgId?: string;
    };
/**
 * Report a message or a person (batch B4, android ReportSheet): a reason (with "Just don't want to see them? Block"),
 * then a review step that says who reads it and exactly what's shared, an optional note, Send. Messages are stored by the server; sending this report additionally shares the selected context with reviewers.
 */
export function ReportDialog({ target, onBlock, onClose }: { target: ReportTarget; onBlock?: () => void; onClose: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const users = useOrbit((s) => s.users);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [to, setTo] = useState<string>(target.kind === "person" ? (target.orgId ?? "") : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const personName = target.kind !== "message" ? target.name : (users[target.message.senderUserId]?.displayName ?? uiText("messaging.interface.this_person_af49636"));
  const community = reason ? (target.kind === "message" ? goesToCommunity(reason, target.conversationType, false) : target.kind === "person" && goesToCommunity(reason, null, !!to)) : false;
  const communityName = target.kind === "message" ? target.orgName : target.kind === "person" ? (target.communities.find((c) => c.id === to)?.name ?? null) : target.name;
  const send = async () => {
    if (!reason) return;
    setBusy(true);
    setError(null);
    try {
      let sent;
      if (target.kind === "community") sent = await sendCommunityReport(engine, target.orgId, reason, note);
      else if (target.kind === "message") {
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
      setDone(
        sent.repeated
          ? target.kind === "community"
            ? l10n("messaging.reportAlreadySent")
            : uiText("messaging.interface.you_already_reported_this_message_7a6edad")
          : sent.to === "community"
            ? uiText("messaging.interface.report_sent_to_the_moderators_dd7f840")
            : uiText("messaging.interface.report_sent_to_meldiq_s_team_053dff4"),
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : uiText("messaging.interface.couldn_t_send_the_report_bc58358"));
    } finally {
      setBusy(false);
    }
  };
  const title = target.kind === "message" ? uiText("messaging.interface.report_message_0a1e3c5") : uiText("messaging.interface.report_value0_acf3105", { value0: target.name });
  if (done)
    return (
      <Dialog title={title} onClose={onClose}>
        <div className="dialog-body">
          <div className="banner info" role="status">
            {done}
          </div>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn btn-primary" onClick={onClose}>
              {l10n("common.actions.done")}
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
              <Localized k="messaging.interface.what_s_wrong_4b4eb51" />
            </h3>
            <div style={{ display: "grid", gap: 2 }}>
              {REPORT_REASONS.map((r) => (
                <button key={r} className="list-row" onClick={() => setReason(r)}>
                  <span className="lines">
                    <span>{REASON_LABEL[r]}</span>
                    {r === "illegal" && (
                      <small>
                        <Localized k="messaging.interface.goes_to_meldiq_s_team_9b993c7" />
                      </small>
                    )}
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
                <Localized k="messaging.interface.just_don_t_want_to_see_them_block_7414327" slots={[<ShieldBan size={14} />, personName]} />
              </button>
            )}
          </>
        ) : (
          <>
            <h3 className="ws-subhead" style={{ marginTop: 0 }}>
              <Localized k="messaging.interface.review_your_report_f20b107" />
            </h3>
            {target.kind === "person" && target.communities.length > 0 && reason !== "illegal" && (
              <div className="field">
                <label htmlFor="rp-to">
                  <Localized k="messaging.interface.send_to_9bcbb3b" />
                </label>
                <select id="rp-to" className="input" value={to} onChange={(e) => setTo(e.target.value)}>
                  <option value="">
                    <Localized k="messaging.interface.meldiq_s_team_16bab38" />
                  </option>
                  {target.communities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <p style={{ margin: 0 }}>
              <strong>{REASON_LABEL[reason]}.</strong>{" "}
              {community
                ? uiText("messaging.interface.goes_to_the_moderators_of_value0_they_won_t_see_that_it_was_you_24b55fe", {
                    value0: communityName ?? uiText("organization.interface.the_community_3c1ea1c"),
                  })
                : uiText("messaging.interface.goes_to_meldiq_s_team_b5c9952")}
            </p>
            <div className="card" style={{ padding: 12, display: "grid", gap: 6 }}>
              <strong style={{ fontSize: 13 }}>
                <Localized k="messaging.interface.what_s_shared_bbb856d" />
              </strong>
              <span className="muted" style={{ fontSize: 13 }}>
                {target.kind === "message"
                  ? uiText("messaging.interface.this_message_and_up_to_value0_messages_before_it_as_you_see_them_4fb36ce", { value0: REPORT_CONTEXT })
                  : uiText("messaging.interface.who_you_re_reporting_the_reason_and_your_note_82302b9")}
              </span>
              {target.kind === "message" && target.message.text && <blockquote className="report-message">{target.message.text}</blockquote>}
            </div>
            <div className="field">
              <label htmlFor="rp-note">
                <Localized k="messaging.interface.add_details_optional_51f942f" />
              </label>
              <textarea id="rp-note" className="textarea" rows={3} maxLength={REPORT_NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setReason(null)}>
                {l10n("common.actions.back")}
              </button>
              <button className="btn btn-danger" disabled={busy} onClick={() => void send()}>
                <Flag size={15} /> {busy ? l10n("common.common_sending") : uiText("messaging.interface.send_report_a44d353")}
              </button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
