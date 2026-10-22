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
      <div className="segmented" role="tablist" aria-label="Reports">
        <button role="tab" aria-selected={tab === "open"} onClick={() => setTab("open")}>
          Open{list.data ? ` (${list.data.open})` : ""}
        </button>
        <button role="tab" aria-selected={tab === "closed"} onClick={() => setTab("closed")}>
          Closed
        </button>
      </div>
      <p className="faint" style={{ margin: 0, fontSize: 13 }}>
        Closed reports are deleted after 90 days. Moderators never see who reported.
      </p>
      <ErrorLine text={list.error ?? act.error} />
      {(list.data?.reports ?? []).map((r) => {
        const aboutMe = r.target?.id === me && !owner;
        return (
          <Card
            key={r.id}
            title={REASON_LABEL[r.reason as ReportReason] ?? r.reason}
            sub={`${r.target?.displayName ?? "Someone"}${r.target?.username ? ` (@${r.target.username})` : ""}${r.conversationName ? ` · in #${r.conversationName}` : ""} · ${shortWhen(r.createdAt)}`}
          >
            {r.content?.context && r.content.context.length > 0 && (
              <div className="report-context" aria-label="Before it">
                {r.content.context.map((c, i) => (
                  <p key={i} className="faint">
                    <strong>{users[c.senderUserId]?.displayName ?? "Someone"}:</strong> {c.text}
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
                {a.size ? ` · ${bytes(a.size)}` : ""}
              </p>
            ))}
            {r.note && (
              <p style={{ margin: 0 }}>
                <span className="faint">Their note: </span>
                {r.note}
              </p>
            )}
            {r.status !== "open" && (
              <p className="faint" style={{ margin: 0 }}>
                {r.status === "actioned" ? "Handled" : r.status === "dismissed" ? "Dismissed" : "Changed in a newer version of Meldiq"} by {r.handledBy?.displayName ?? "a moderator"}
                {r.handledNote ? ` · ${r.handledNote}` : ""}
              </p>
            )}
            {aboutMe ? (
              <p className="faint" style={{ margin: 0 }}>
                This report is about you, so another moderator handles it.
              </p>
            ) : r.status === "open" ? (
              <>
                <input
                  className="input"
                  aria-label="Note for other moderators"
                  placeholder="Note for other moderators (optional)"
                  maxLength={500}
                  value={notes[r.id] ?? ""}
                  onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                />
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn btn-primary btn-sm" disabled={act.busy} onClick={() => set(r.id, "actioned")}>
                    Mark as handled
                  </button>
                  <button className="btn btn-secondary btn-sm" disabled={act.busy} onClick={() => set(r.id, "dismissed")}>
                    Dismiss
                  </button>
                </div>
              </>
            ) : (
              <div>
                <button className="btn btn-ghost btn-sm" disabled={act.busy} onClick={() => set(r.id, "open")}>
                  Reopen
                </button>
              </div>
            )}
          </Card>
        );
      })}
      {list.data?.reports.length === 0 && <p className="faint">{tab === "open" ? "No open reports." : "No closed reports in the last 90 days."}</p>}
    </div>
  );
}
