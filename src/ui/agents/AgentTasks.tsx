import { ArrowLeft, ClipboardList, Plus, Upload } from "lucide-react";
import { useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { rolesOverview } from "../../sync/roles";
import {
  type AiOverview,
  createTask,
  getTask,
  listTasks,
  setTaskSettings,
  type Task,
  type TaskAction,
  TASK_STATE_LABEL,
  taskAction,
  taskSettings,
  type TaskSummary,
  uploadAgentFile,
} from "../../sync/aiWorkforce";
import { directory } from "../../sync/workspaces";
import { relative } from "../format";
import { Dialog } from "../components/Overlay";
import { Card, ErrorLine } from "../workspace/WorkspaceView";
import { useAction, useLoad } from "../workspace/useLoad";
import { AgentFileView } from "./AgentBits";

/**
 * Tasks for people (server docs/AI_WORKFORCE_2_PLAN.md, phase 4): work the Agent Manager or an admin gives someone.
 * The assignee accepts, works, and hands in a note or files; someone else accepts it. The server decides who may do
 * what (each task says so in `can`); this view only shows those actions. Tasks aren't end-to-end encrypted.
 */
type Scope = "mine" | "created" | "all";
const TASK_NOTICE = "Tasks, notes and files handed in aren't end-to-end encrypted: they're kept on Meldiq's servers so agents and reviewers can use them.";
const PRIORITY_LABEL = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" } as const;

const due = (t: Pick<TaskSummary, "dueAt" | "overdue">) => (t.dueAt === null ? "No due time" : `${t.overdue ? "Overdue: due" : "Due"} ${new Date(t.dueAt).toLocaleString()}`);

export function TasksTab({ orgId, o, open }: { orgId: string; o: AiOverview; /** A task to show first (from the work overview). */ open?: string | null }) {
  const engine = useEngine();
  const rev = useOrbit((s) => s.aiJobsRev);
  const [scope, setScope] = useState<Scope>("mine");
  const [opened, setOpened] = useState<string | null>(open ?? null);
  const [creating, setCreating] = useState(false);
  const list = useLoad(() => listTasks(engine, orgId, scope), [engine, orgId, scope, rev]);
  if (opened) return <TaskDetail orgId={orgId} taskId={opened} onBack={() => setOpened(null)} />;
  const scopes: [Scope, string][] = [["mine", "Assigned to me"], ["created", "Created by me"], ...(o.permissions.canManage ? ([["all", "Everyone's"]] as [Scope, string][]) : [])];
  return (
    <>
      <div className="banner info">
        <ClipboardList size={16} /> <span className="grow">{TASK_NOTICE}</span>
      </div>
      <Card
        title="Tasks"
        sub="Work for people, from the Agent Manager or an admin. Open one to accept it, hand it in or review it."
        actions={
          o.permissions.canManage ? (
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              <Plus size={14} /> New task
            </button>
          ) : undefined
        }
      >
        <span className="segmented" role="tablist" aria-label="Which tasks">
          {scopes.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={scope === k} aria-pressed={scope === k} onClick={() => setScope(k)}>
              {label}
            </button>
          ))}
        </span>
        <ErrorLine text={list.error} />
        {!list.data ? (
          !list.error && <div className="skeleton" style={{ height: 80 }} aria-busy="true" />
        ) : list.data.tasks.length === 0 ? (
          <p className="muted">{scope === "mine" ? "Nothing is assigned to you." : "No tasks yet."}</p>
        ) : (
          <ul className="ws-list">
            {list.data.tasks.map((t) => (
              <li key={t.id} className="ws-row task-row">
                <span className="lines grow">
                  <span>
                    {t.title} {t.priority !== "normal" && <span className={`status-pill ${t.priority === "urgent" || t.priority === "high" ? "warn" : ""}`}>{PRIORITY_LABEL[t.priority]}</span>}
                  </span>
                  <small>
                    {TASK_STATE_LABEL[t.state]} · {scope === "mine" ? `from ${t.agent?.name ?? t.createdBy.name}` : `for ${t.assignee.name}`} ·{" "}
                    <span className={t.overdue ? "danger-text" : undefined}>{due(t)}</span>
                  </small>
                </span>
                <button className="btn btn-secondary" onClick={() => setOpened(t.id)}>
                  Open
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {scope === "all" && list.data?.report && (
        <Card title="Workforce report" sub="Counts from the task records.">
          <p>
            {Object.entries(list.data.report.byState)
              .map(([s, n]) => `${TASK_STATE_LABEL[s as keyof typeof TASK_STATE_LABEL] ?? s}: ${n}`)
              .join(" · ") || "No tasks."}{" "}
            · Overdue: {list.data.report.overdue}
          </p>
          {list.data.report.byAssignee.length > 0 && (
            <ul className="ws-list">
              {list.data.report.byAssignee.map((p) => (
                <li key={p.person.id} className="ws-row">
                  <span className="grow">{p.person.name}</span>
                  <small>
                    {p.active} open{p.overdue ? ` · ${p.overdue} overdue` : ""}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      {o.permissions.canManage && <AssignmentCard orgId={orgId} />}
      {creating && <NewTaskDialog orgId={orgId} onClose={() => setCreating(false)} onCreated={(id) => (setCreating(false), setOpened(id))} />}
    </>
  );
}

/** Who the Agent Manager may give work to: roles and people. Nobody until set. */
function AssignmentCard({ orgId }: { orgId: string }) {
  const engine = useEngine();
  const settings = useLoad(() => taskSettings(engine, orgId), [engine, orgId]);
  const roles = useLoad(() => rolesOverview(engine, orgId).catch(() => null), [engine, orgId]);
  const members = useLoad(() => directory(engine, orgId), [engine, orgId]);
  const act = useAction();
  const s = settings.data;
  const save = (r: string[], u: string[]) =>
    void act.act(async () => {
      await setTaskSettings(engine, orgId, r, u);
      settings.reload();
    });
  return (
    <Card
      title="Who the Agent Manager may give work to"
      sub="It only assigns tasks to these people, picking by the role it asks for and who has the least open work, and only when someone who manages AI agents asks it."
    >
      <ErrorLine text={settings.error ?? act.error} />
      {!s ? (
        <div className="skeleton" style={{ height: 60 }} aria-busy="true" />
      ) : (
        <>
          <fieldset className="check-grid">
            <legend>Roles</legend>
            {(roles.data?.roles ?? []).length === 0 && <p className="muted">This community has no roles yet.</p>}
            {(roles.data?.roles ?? []).map((r) => (
              <label key={r.id}>
                <input
                  type="checkbox"
                  checked={s.roles.includes(r.id)}
                  disabled={act.busy}
                  onChange={(e) => save(e.target.checked ? [...s.roles, r.id] : s.roles.filter((x) => x !== r.id), s.users)}
                />{" "}
                {r.name}
              </label>
            ))}
          </fieldset>
          <label className="field">
            <span>Also these people</span>
            <select aria-label="Add a person" value="" disabled={act.busy} onChange={(e) => e.target.value && save(s.roles, [...s.users, e.target.value])}>
              <option value="">Add a person…</option>
              {(members.data ?? [])
                .filter((m) => !s.users.includes(m.id))
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
            </select>
          </label>
          <p className="muted">
            {s.eligible.length === 0
              ? "Nobody yet: the Agent Manager can't give work to people."
              : `Eligible now: ${s.eligible.map((p) => `${p.name}${p.roles.length ? ` (${p.roles.join(", ")})` : ""}`).join(", ")}.`}
          </p>
          {s.users.length > 0 && (
            <ul className="ws-list">
              {s.users.map((u) => (
                <li key={u} className="ws-row">
                  <span className="grow">{members.data?.find((m) => m.id === u)?.displayName ?? u}</span>
                  <button
                    className="btn btn-secondary"
                    disabled={act.busy}
                    onClick={() =>
                      save(
                        s.roles,
                        s.users.filter((x) => x !== u),
                      )
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}

function NewTaskDialog({ orgId, onClose, onCreated }: { orgId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const engine = useEngine();
  const members = useLoad(() => directory(engine, orgId), [engine, orgId]);
  const act = useAction();
  const [f, setF] = useState({ title: "", instructions: "", deliverables: "", assigneeId: "", due: "", priority: "normal" as Task["priority"] });
  const set = (p: Partial<typeof f>) => setF((cur) => ({ ...cur, ...p }));
  const valid = f.title.trim() && f.instructions.trim() && f.assigneeId;
  return (
    <Dialog
      title="New task"
      onClose={onClose}
      footer={
        <button
          className="btn btn-primary"
          disabled={!valid || act.busy}
          onClick={() =>
            void act.act(async () => {
              const t = await createTask(engine, orgId, {
                title: f.title.trim(),
                instructions: f.instructions.trim(),
                deliverables: f.deliverables.trim(),
                assigneeId: f.assigneeId,
                dueAt: f.due ? new Date(f.due).getTime() : null,
                priority: f.priority,
                conversationId: null,
              });
              onCreated(t.id);
            })
          }
        >
          {act.busy ? "Creating…" : "Give the task"}
        </button>
      }
    >
      <ErrorLine text={act.error ?? members.error} />
      <label className="field">
        <span>Title</span>
        <input value={f.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} />
      </label>
      <label className="field">
        <span>What to do</span>
        <textarea rows={4} value={f.instructions} maxLength={4000} onChange={(e) => set({ instructions: e.target.value })} />
      </label>
      <label className="field">
        <span>What to hand in (optional)</span>
        <input value={f.deliverables} maxLength={1000} onChange={(e) => set({ deliverables: e.target.value })} />
      </label>
      <label className="field">
        <span>For</span>
        <select value={f.assigneeId} onChange={(e) => set({ assigneeId: e.target.value })}>
          <option value="">Choose someone…</option>
          {(members.data ?? []).map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Due (optional)</span>
        <input type="datetime-local" value={f.due} onChange={(e) => set({ due: e.target.value })} />
      </label>
      <label className="field">
        <span>Priority</span>
        <select value={f.priority} onChange={(e) => set({ priority: e.target.value as Task["priority"] })}>
          {Object.entries(PRIORITY_LABEL).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <p className="muted">{TASK_NOTICE}</p>
    </Dialog>
  );
}

const ACTION_LABEL: Record<TaskAction, string> = {
  accept: "Accept",
  start: "Start",
  block: "I'm blocked",
  submit: "Hand in",
  approve: "Accept the work",
  return: "Send back",
  cancel: "Cancel task",
  reassign: "Reassign",
};

export function TaskDetail({ orgId, taskId, onBack }: { orgId: string; taskId: string; onBack: () => void }) {
  const engine = useEngine();
  const rev = useOrbit((s) => s.aiJobsRev);
  const loaded = useLoad(() => getTask(engine, orgId, taskId), [engine, orgId, taskId, rev]);
  const act = useAction();
  const [form, setForm] = useState<TaskAction | null>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [assignee, setAssignee] = useState("");
  const members = useLoad(() => (form === "reassign" ? directory(engine, orgId) : Promise.resolve([])), [engine, orgId, form]);
  const t = loaded.data?.task;
  const run = (action: TaskAction) =>
    void act.act(async () => {
      if (!t) return;
      const fileIds = action === "submit" ? await Promise.all(files.map(async (f) => (await uploadAgentFile(engine, orgId, f)).id)) : undefined;
      const body =
        action === "submit"
          ? { note: text.trim() || undefined, fileIds }
          : action === "reassign"
            ? { assigneeId: assignee }
            : action === "block" || action === "return" || action === "cancel"
              ? { reason: text.trim() || undefined }
              : {};
      await taskAction(engine, orgId, t, action, body);
      loaded.reload();
      setForm(null);
      setText("");
      setFiles([]);
    });
  const needsForm = (a: TaskAction) => a === "submit" || a === "block" || a === "return" || a === "cancel" || a === "reassign";
  return (
    <div className="ws-page">
      <button className="btn btn-secondary" style={{ justifySelf: "start" }} onClick={onBack}>
        <ArrowLeft size={14} /> Tasks
      </button>
      <ErrorLine text={loaded.error ?? act.error} />
      {!t ? (
        !loaded.error && <div className="skeleton" style={{ height: 160 }} aria-busy="true" />
      ) : (
        <>
          <Card title={t.title} sub={`${TASK_STATE_LABEL[t.state]} · for ${t.assignee.name} · from ${t.agent ? `${t.agent.name}, asked by ${t.createdBy.name}` : t.createdBy.name} · ${due(t)}`}>
            <p style={{ whiteSpace: "pre-wrap" }}>{t.instructions}</p>
            {t.deliverables && (
              <p>
                <strong>Hand in:</strong> {t.deliverables}
              </p>
            )}
            {t.blockedReason && t.state === "blocked" && <div className="banner warn">Blocked: {t.blockedReason}</div>}
            {t.returnReason && t.state === "in_progress" && <div className="banner warn">Sent back: {t.returnReason}</div>}
            {t.cancelReason && t.state === "cancelled" && <div className="banner">Cancelled: {t.cancelReason}</div>}
            {t.references.length > 0 && (
              <>
                <h4>To work from</h4>
                {t.references.map((f) => (
                  <AgentFileView key={f.id} orgId={orgId} file={f} />
                ))}
              </>
            )}
            {(t.submissionNote || t.files.length > 0) && (
              <>
                <h4>Handed in{t.submittedAt ? ` ${relative(t.submittedAt)}` : ""}</h4>
                {t.submissionNote && <p style={{ whiteSpace: "pre-wrap" }}>{t.submissionNote}</p>}
                {t.files.map((f) => (
                  <AgentFileView key={f.id} orgId={orgId} file={f} />
                ))}
              </>
            )}
            <div className="row-actions">
              {(Object.keys(ACTION_LABEL) as TaskAction[])
                .filter((a) => t.can[a])
                .map((a) => (
                  <button
                    key={a}
                    className={a === "approve" || a === "accept" || a === "submit" ? "btn btn-primary" : "btn btn-secondary"}
                    disabled={act.busy}
                    onClick={() => (needsForm(a) ? setForm(a) : run(a))}
                  >
                    {ACTION_LABEL[a]}
                  </button>
                ))}
            </div>
            {form && (
              <div className="card">
                {form === "reassign" ? (
                  <label className="field">
                    <span>Give it to</span>
                    <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                      <option value="">Choose someone…</option>
                      {(members.data ?? [])
                        .filter((m) => m.id !== t.assignee.id)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.displayName}
                          </option>
                        ))}
                    </select>
                  </label>
                ) : (
                  <label className="field">
                    <span>{form === "submit" ? "Note (what you did)" : form === "block" ? "What's blocking it" : form === "return" ? "What needs changing" : "Why (optional)"}</span>
                    <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
                  </label>
                )}
                {form === "submit" && (
                  <label className="field">
                    <span>
                      <Upload size={14} /> Files (photos, videos, documents)
                    </span>
                    <input type="file" multiple onChange={(e) => setFiles([...(e.target.files ?? [])])} />
                  </label>
                )}
                {form === "submit" && <p className="muted">{TASK_NOTICE}</p>}
                <div className="row-actions">
                  <button
                    className="btn btn-primary"
                    disabled={act.busy || (form === "reassign" && !assignee) || ((form === "block" || form === "return") && !text.trim()) || (form === "submit" && !text.trim() && files.length === 0)}
                    onClick={() => run(form)}
                  >
                    {act.busy ? "Saving…" : ACTION_LABEL[form]}
                  </button>
                  <button className="btn btn-secondary" disabled={act.busy} onClick={() => setForm(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </Card>
          <Card title="History">
            <ul className="ws-list">
              {(loaded.data?.events ?? []).map((e, i) => (
                <li key={i} className="ws-row">
                  <span className="grow">
                    {e.kind.replace("_", " ")}
                    {e.actor ? ` by ${e.actor.name}` : ""}
                    {typeof e.detail.reason === "string" ? `: ${e.detail.reason}` : typeof e.detail.note === "string" ? `: ${e.detail.note}` : ""}
                  </span>
                  <small>{relative(e.at)}</small>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
