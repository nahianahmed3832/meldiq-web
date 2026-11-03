import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Flag, Paperclip } from "lucide-react";
import { useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { communityReports, REASON_LABEL, type ReportReason, setReportStatus } from "../../sync/reports";
import { bytes, shortWhen } from "../format";
import { useAction, useLoad } from "./useLoad";
import { Card, ErrorLine } from "./WorkspaceView";
/**
 * Reports (batch B4, android ReportsScreen): Open and Closed. Each shows the reason, who was reported, where, what the
 * reporter's app shared and their note, and never who reported. Mark as handled or dismiss with a note; reopen. A
 * report about you is left to another moderator.
 */
export function ReportsPage({ detail }: { detail: OrgAdminDetail }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const rev = useOrbit((s) => s.moderationRev);
  const users = useOrbit((s) => s.users);
  const [tab, setTab] = useState<"open" | "closed">("open");
  const [tick, setTick] = useState(0);
  const list = useLoad(() => communityReports(engine, detail.org.id, tab), [engine, detail.org.id, tab, rev, tick]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const act = useAction();
  const me = engine.device.userId;
  const owner = detail.permissions.isOwner;
  const set = (id: string, status: "open" | "actioned" | "dismissed") => void act.act(() => setReportStatus(engine, id, status, notes[id] ?? null).then(() => setTick((t) => t + 1)));
  return (
    <div className="ws-page">
      <div className="segmented" role="tablist" aria-label={uiText("workspace.interface.reports_dacca3c")}>
        <button role="tab" aria-selected={tab === "open"} onClick={() => setTab("open")}>
          {l10n("workspace.discover_open_btn")}
          {list.data ? uiText("workspace.interface.value0_c9bd7bc", { value0: list.data.open }) : ""}
        </button>
        <button role="tab" aria-selected={tab === "closed"} onClick={() => setTab("closed")}>
          <Localized k="messaging.interface.closed_c21ead0" />
        </button>
      </div>
      <p className="faint" style={{ margin: 0, fontSize: 13 }}>
        <Localized k="workspace.interface.closed_reports_are_deleted_after_90_days_moderators_never_see_who_532a0bd" />
      </p>
      <ErrorLine text={list.error ?? act.error} />
      {(list.data?.reports ?? []).map((r) => {
        const aboutMe = r.target?.id === me && !owner;
        return (
          <Card
            key={r.id}
            title={REASON_LABEL[r.reason as ReportReason] ?? r.reason}
            sub={uiText("workspace.interface.value0_value1_value2_value3_733cd5c", {
              value0: r.target?.displayName ?? l10n("messaging.react_someone"),
              value1: r.target?.username ? ` (@${r.target.username})` : "",
              value2: r.conversationName ? uiText("workspace.interface.in_f338e7a", { value0: r.conversationName }) : "",
              value3: shortWhen(r.createdAt),
            })}
          >
            {r.content?.context && r.content.context.length > 0 && (
              <div className="report-context" aria-label={uiText("workspace.interface.before_it_2465b04")}>
                {r.content.context.map((c, i) => (
                  <p key={i} className="faint">
                    <strong>{users[c.senderUserId]?.displayName ?? l10n("messaging.react_someone")}:</strong> {c.text}
                  </p>
                ))}
              </div>
            )}
            {r.content?.text && (
              <blockquote className="report-message">
                <Flag size={13} aria-hidden /> {r.content.text}
              </blockquote>
            )}
            {r.content?.attachments?.map((a, i) => (
              <p key={i} className="faint" style={{ margin: 0 }}>
                <Paperclip size={13} aria-hidden /> {a.name}
                {a.size ? uiText("calls.interface.value0_9402340", { value0: bytes(a.size) }) : ""}
              </p>
            ))}
            {r.note && (
              <p style={{ margin: 0 }}>
                <span className="faint">
                  <Localized k="workspace.interface.their_note_06f7ef7" />
                </span>
                {r.note}
              </p>
            )}
            {r.status !== "open" && (
              <p className="faint" style={{ margin: 0 }}>
                <Localized
                  k="workspace.interface.by_5d1cadb"
                  slots={[
                    r.status === "actioned"
                      ? uiText("workspace.interface.handled_1e7536d")
                      : r.status === "dismissed"
                        ? uiText("workspace.interface.dismissed_9d74727")
                        : uiText("workspace.interface.changed_in_a_newer_version_of_meldiq_a2f20eb"),
                    r.handledBy?.displayName ?? uiText("workspace.interface.a_moderator_7858d92"),
                    r.handledNote ? uiText("calls.interface.value0_9402340", { value0: r.handledNote }) : "",
                  ]}
                />
              </p>
            )}
            {aboutMe ? (
              <p className="faint" style={{ margin: 0 }}>
                <Localized k="workspace.interface.this_report_is_about_you_so_another_moderator_handles_it_e318dec" />
              </p>
            ) : r.status === "open" ? (
              <>
                <input
                  className="input"
                  aria-label={uiText("workspace.interface.note_for_other_moderators_0be175e")}
                  placeholder={uiText("workspace.interface.note_for_other_moderators_optional_cc23bc9")}
                  maxLength={500}
                  value={notes[r.id] ?? ""}
                  onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                />
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn btn-primary btn-sm" disabled={act.busy} onClick={() => set(r.id, "actioned")}>
                    <Localized k="workspace.interface.mark_as_handled_2718422" />
                  </button>
                  <button className="btn btn-secondary btn-sm" disabled={act.busy} onClick={() => set(r.id, "dismissed")}>
                    <Localized k="calls.interface.dismiss_48845bf" />
                  </button>
                </div>
              </>
            ) : (
              <div>
                <button className="btn btn-ghost btn-sm" disabled={act.busy} onClick={() => set(r.id, "open")}>
                  <Localized k="workspace.interface.reopen_a886d1d" />
                </button>
              </div>
            )}
          </Card>
        );
      })}
      {list.data?.reports.length === 0 && (
        <p className="faint">{tab === "open" ? uiText("workspace.interface.no_open_reports_e7c045c") : uiText("workspace.interface.no_closed_reports_in_the_last_90_days_873e2dc")}</p>
      )}
    </div>
  );
}
