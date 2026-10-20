import { History, Pencil, Plus, Sparkles, Trash2, TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine } from "../../app/orbit";
import { browserZone } from "../../sync/reminderRules";
import {
  blankWorkflow,
  cancelRun,
  deleteWorkflow,
  fromTemplate,
  inputOf,
  listWorkflows,
  updateWorkflow,
  type WfInput,
  type WfTemplate,
  workflowCatalog,
  workflowRuns,
  type Workflow,
  workflowSummary,
} from "../../sync/workflows";
import { workspaceChannels } from "../../sync/workspaces";
import { Dialog } from "../components/Overlay";
import { fullTime, relative } from "../format";
import { useAction, useLoad } from "./useLoad";
import { WorkflowEditor } from "./WorkflowEditor";
import { AiWorkflowDraftDialog, useAiStatus } from "../ai/AiDialogs";
import { Card, ErrorLine } from "./WorkspaceView";

const STATE: Record<string, string> = { done: "Done", failed: "Failed", queued: "Queued", running: "Running", skipped: "Skipped", cancelled: "Cancelled", partial: "Partly done" };

/**
 * Workspace › Workflows (android round 7 C3 WorkflowsScreen): the workspace's automations, made from a template or from
 * scratch, turned on or off, with their run history. People with `workflows.manage` only; the server checks again.
 */
export function WorkflowsPage({ detail }: { detail: OrgAdminDetail }) {
  const engine = useEngine();
  const orgId = detail.org.id;
  const [tick, setTick] = useState(0);
  const list = useLoad(() => listWorkflows(engine, orgId), [engine, orgId, tick]);
  const catalog = useLoad(() => workflowCatalog(engine, orgId), [engine, orgId]);
  const channels = useLoad(() => workspaceChannels(engine, orgId, false), [engine, orgId]);
  const [editing, setEditing] = useState<{ start: WfInput; existing: Workflow | null } | null>(null);
  const [drafting, setDrafting] = useState(false);
  const ai = useAiStatus(orgId);
  const [picking, setPicking] = useState<WfTemplate | null>(null);
  const [runsOf, setRunsOf] = useState<Workflow | null>(null);
  const act = useAction();
  const reload = () => setTick((t) => t + 1);
  const today = new Date().toISOString().slice(0, 10);

  const fromTpl = (t: WfTemplate, channelId: string | null) => {
    setPicking(null);
    setEditing({ start: fromTemplate(t, channelId, today, browserZone()), existing: null });
  };

  return (
    <div className="ws-page">
      <Card
        title="Workflows"
        sub="When something happens in this workspace, do something: post an update, add a member to channels, or email the admins. They run on the server with their owner's rights."
        actions={
          <>
            {ai?.available && (
              <button className="btn btn-secondary btn-sm" disabled={!catalog.data} onClick={() => setDrafting(true)}>
                <Sparkles size={14} /> Draft with AI
              </button>
            )}
            <button className="btn btn-primary btn-sm" disabled={!catalog.data} onClick={() => setEditing({ start: blankWorkflow(), existing: null })}>
              <Plus size={14} /> New workflow
            </button>
          </>
        }
      >
        <ErrorLine text={list.error ?? act.error} />
        {list.data && list.data.length === 0 && <p className="faint">No workflows yet. Start from a template below, or make one.</p>}
        <ul className="ws-list">
          {(list.data ?? []).map((w) => (
            <li key={w.id} className="ws-row">
              <span className="lines grow">
                <strong>{w.name}</strong>
                <small>
                  {catalog.data?.catalog.triggers.find((t) => t.type === w.trigger.type)?.label ?? w.trigger.type} · {workflowSummary(w)}
                  {w.lastRun ? ` · last run ${STATE[w.lastRun.state]?.toLowerCase() ?? w.lastRun.state} ${relative(w.lastRun.at)}` : " · hasn't run yet"}
                </small>
                {!w.owner.allowed && (
                  <small className="warn-text">
                    <TriangleAlert size={12} /> {w.owner.name ?? "Its owner"} can no longer manage workflows, so it fails. Saving it again makes you its owner.
                  </small>
                )}
              </span>
              <label className="row" style={{ gap: 6, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={w.enabled}
                  disabled={act.busy}
                  onChange={(e) => void act.act(() => updateWorkflow(engine, orgId, w.id, w.rev, { ...inputOf(w), enabled: e.target.checked }).then(reload))}
                />
                On
              </label>
              <button className="icon-btn" aria-label={`Runs of ${w.name}`} title="Run history" onClick={() => setRunsOf(w)}>
                <History size={16} />
              </button>
              <button className="icon-btn" aria-label={`Edit ${w.name}`} onClick={() => setEditing({ start: inputOf(w), existing: w })} disabled={!catalog.data}>
                <Pencil size={15} />
              </button>
              <button className="icon-btn" aria-label={`Delete ${w.name}`} onClick={() => void act.act(() => deleteWorkflow(engine, orgId, w.id).then(reload))}>
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {catalog.data && catalog.data.templates.length > 0 && (
        <Card title="Templates" sub="Ready-made workflows; you pick the channel before saving.">
          <ul className="ws-list">
            {catalog.data.templates.map((t) => (
              <li key={t.id} className="ws-row">
                <span className="lines grow">
                  <strong>{t.name}</strong>
                  <small>{t.description}</small>
                </span>
                <button className="btn btn-secondary btn-sm" onClick={() => (t.needs.includes("channel") ? setPicking(t) : fromTpl(t, null))}>
                  Use
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {picking && (
        <Dialog title={picking.name} onClose={() => setPicking(null)}>
          <div className="dialog-body">
            <p className="faint" style={{ margin: 0 }}>
              Which channel should it use?
            </p>
            <ul className="ws-list">
              {(channels.data ?? []).map((c) => (
                <li key={c.id}>
                  <button className="list-row" onClick={() => fromTpl(picking, c.id)}>
                    #{c.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Dialog>
      )}
      {drafting && (
        <AiWorkflowDraftDialog
          orgId={orgId}
          onClose={() => setDrafting(false)}
          onOpen={(draft) => {
            setDrafting(false);
            setEditing({ start: draft, existing: null });
          }}
        />
      )}
      {editing && catalog.data && (
        <WorkflowEditor
          orgId={orgId}
          catalog={catalog.data.catalog}
          channels={channels.data ?? []}
          start={editing.start}
          existing={editing.existing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
      {runsOf && <RunsDialog orgId={orgId} workflow={runsOf} onClose={() => setRunsOf(null)} />}
    </div>
  );
}

function RunsDialog({ orgId, workflow, onClose }: { orgId: string; workflow: Workflow; onClose: () => void }) {
  const engine = useEngine();
  const [tick, setTick] = useState(0);
  const runs = useLoad(() => workflowRuns(engine, orgId, workflow.id), [engine, orgId, workflow.id, tick]);
  const act = useAction();
  return (
    <Dialog title={`Runs · ${workflow.name}`} wide onClose={onClose}>
      <div className="dialog-body">
        <ErrorLine text={runs.error ?? act.error} />
        {runs.data?.length === 0 && <p className="faint">No runs yet.</p>}
        <ul className="ws-list">
          {(runs.data ?? []).map((r) => (
            <li key={r.id} className="ws-row" style={{ alignItems: "flex-start" }}>
              <span className="lines grow">
                <strong>
                  {STATE[r.state] ?? r.state} · {fullTime(r.createdAt)}
                </strong>
                <small>
                  {r.event.member ? `for ${r.event.member.name}` : r.event.channel ? `for #${r.event.channel.name}` : "on schedule"}
                  {r.attempts > 1 ? ` · ${r.attempts} attempts` : ""}
                  {r.errorKind ? ` · ${r.errorKind}` : ""}
                </small>
                {r.outcomes.map((o, i) => (
                  <small key={i} className="faint">
                    Action {i + 1}: {o.status} · {o.detail}
                  </small>
                ))}
              </span>
              {r.state === "queued" && (
                <button className="btn btn-ghost btn-sm" disabled={act.busy} onClick={() => void act.act(() => cancelRun(engine, orgId, r.id).then(() => setTick((t) => t + 1)))}>
                  <X size={13} /> Cancel
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}
