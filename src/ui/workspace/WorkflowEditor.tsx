import { FlaskConical, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Conversation } from "../../api/schemas";
import { useEngine } from "../../app/orbit";
import { browserZone } from "../../sync/reminderRules";
import {
  actionsFor,
  createWorkflow,
  fieldLabel,
  fieldsFor,
  MAX_ACTIONS,
  MAX_CONDITIONS,
  MAX_TEXT,
  newAction,
  OPS,
  opLabel,
  RECURRENCES,
  testWorkflow,
  updateWorkflow,
  type WfAction,
  type WfCatalog,
  type WfInput,
  type WfTest,
  withTrigger,
  type Workflow,
  workflowProblems,
} from "../../sync/workflows";
import { Dialog } from "../components/Overlay";
import { useAction } from "./useLoad";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * A workflow's editor (android round 7 WorkflowEditorScreen): trigger, conditions that fit it, one to five actions,
 * Test (a dry run that changes nothing) and Save. Saving makes you the owner: it then runs with your rights.
 */
export function WorkflowEditor(props: { orgId: string; catalog: WfCatalog; channels: Conversation[]; start: WfInput; existing: Workflow | null; onSaved: () => void; onClose: () => void }) {
  const engine = useEngine();
  const [w, setW] = useState<WfInput>(props.start);
  const [test, setTest] = useState<WfTest | null>(null);
  const act = useAction();
  const problems = workflowProblems(w);
  const zone = browserZone();
  const fields = fieldsFor(props.catalog, w.trigger.type);
  const setAction = (i: number, a: WfAction) => setW({ ...w, actions: w.actions.map((x, j) => (j === i ? a : x)) });
  const save = () =>
    void act.act(async () => {
      if (props.existing) await updateWorkflow(engine, props.orgId, props.existing.id, props.existing.rev, w);
      else await createWorkflow(engine, props.orgId, w);
      props.onSaved();
    });
  return (
    <Dialog
      title={props.existing ? "Edit workflow" : "New workflow"}
      wide
      onClose={props.onClose}
      footer={
        <>
          <button className="btn btn-secondary" disabled={problems.length > 0 || act.busy} onClick={() => void act.act(async () => setTest(await testWorkflow(engine, props.orgId, w)))}>
            <FlaskConical size={15} /> Test
          </button>
          <button className="btn btn-primary" disabled={problems.length > 0 || act.busy} onClick={save}>
            {act.busy ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <div className="dialog-body wf-editor">
        <label className="field">
          <span>Name</span>
          <input className="input" value={w.name} maxLength={80} onChange={(e) => setW({ ...w, name: e.target.value })} placeholder="e.g. Welcome new members" />
        </label>

        <section>
          <h3>When</h3>
          <select className="input" value={w.trigger.type} onChange={(e) => setW(withTrigger(w, props.catalog, e.target.value, today(), zone))} aria-label="Trigger">
            {props.catalog.triggers.map((t) => (
              <option key={t.type} value={t.type}>
                {t.label}
              </option>
            ))}
          </select>
          <small className="faint">{props.catalog.triggers.find((t) => t.type === w.trigger.type)?.description}</small>
          {w.trigger.schedule && (
            <div className="wf-row">
              <select
                className="input"
                aria-label="Repeat"
                value={w.trigger.schedule.recurrence}
                onChange={(e) => setW({ ...w, trigger: { ...w.trigger, schedule: { ...w.trigger.schedule!, recurrence: e.target.value } } })}
              >
                {RECURRENCES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <input
                className="input"
                aria-label="Time"
                value={w.trigger.schedule.localTime}
                onChange={(e) => setW({ ...w, trigger: { ...w.trigger, schedule: { ...w.trigger.schedule!, localTime: e.target.value } } })}
                placeholder="09:00"
              />
              <small className="faint">{w.trigger.schedule.timeZone}</small>
            </div>
          )}
        </section>

        {fields.length > 0 && (
          <section>
            <h3>Only if</h3>
            {w.conditions.map((c, i) => (
              <div className="wf-row" key={i}>
                <select className="input" aria-label="Field" value={c.field} onChange={(e) => setW({ ...w, conditions: w.conditions.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)) })}>
                  {fields.map((f) => (
                    <option key={f} value={f}>
                      {fieldLabel(f)}
                    </option>
                  ))}
                </select>
                <select className="input" aria-label="Comparison" value={c.op} onChange={(e) => setW({ ...w, conditions: w.conditions.map((x, j) => (j === i ? { ...x, op: e.target.value } : x)) })}>
                  {OPS.map((o) => (
                    <option key={o} value={o}>
                      {opLabel(o)}
                    </option>
                  ))}
                </select>
                <input
                  className="input"
                  aria-label="Value"
                  value={c.value}
                  maxLength={60}
                  onChange={(e) => setW({ ...w, conditions: w.conditions.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })}
                />
                <button className="icon-btn" aria-label="Remove condition" onClick={() => setW({ ...w, conditions: w.conditions.filter((_, j) => j !== i) })}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            {w.conditions.length < MAX_CONDITIONS && (
              <button className="btn btn-ghost btn-sm" onClick={() => setW({ ...w, conditions: [...w.conditions, { field: fields[0], op: "is", value: "" }] })}>
                <Plus size={14} /> Add a condition
              </button>
            )}
          </section>
        )}

        <section>
          <h3>Do</h3>
          {w.actions.map((a, i) => (
            <div className="wf-action" key={i}>
              <div className="wf-row">
                <select className="input" aria-label={`Action ${i + 1}`} value={a.type} onChange={(e) => setAction(i, newAction(e.target.value))}>
                  {actionsFor(w.trigger.type).map((t) => (
                    <option key={t} value={t}>
                      {props.catalog.actions.find((x) => x.type === t)?.label ?? t}
                    </option>
                  ))}
                </select>
                {w.actions.length > 1 && (
                  <button className="icon-btn" aria-label="Remove action" onClick={() => setW({ ...w, actions: w.actions.filter((_, j) => j !== i) })}>
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
              <small className="faint">{props.catalog.actions.find((x) => x.type === a.type)?.description}</small>
              {a.type === "post_channel" && (
                <>
                  <ChannelPick channels={props.channels} value={a.channelId ?? ""} onChange={(id) => setAction(i, { ...a, channelId: id || undefined })} />
                  <textarea
                    className="input"
                    rows={2}
                    maxLength={MAX_TEXT}
                    value={a.text ?? ""}
                    onChange={(e) => setAction(i, { ...a, text: e.target.value })}
                    placeholder="Welcome to {workspace}, {member}!"
                  />
                </>
              )}
              {a.type === "add_to_channels" && (
                <div className="wf-channels" role="group" aria-label="Channels">
                  {props.channels.map((c) => (
                    <label key={c.id} className="chip">
                      <input
                        type="checkbox"
                        checked={a.channelIds?.includes(c.id) ?? false}
                        onChange={(e) => setAction(i, { ...a, channelIds: e.target.checked ? [...(a.channelIds ?? []), c.id].slice(0, 10) : (a.channelIds ?? []).filter((x) => x !== c.id) })}
                      />
                      #{c.name}
                    </label>
                  ))}
                </div>
              )}
              {a.type === "email_admins" && (
                <>
                  <input className="input" maxLength={120} value={a.subject ?? ""} onChange={(e) => setAction(i, { ...a, subject: e.target.value })} placeholder="Subject" aria-label="Subject" />
                  <textarea
                    className="input"
                    rows={2}
                    maxLength={MAX_TEXT}
                    value={a.text ?? ""}
                    onChange={(e) => setAction(i, { ...a, text: e.target.value })}
                    placeholder="{member} left {workspace}."
                  />
                </>
              )}
            </div>
          ))}
          {w.actions.length < MAX_ACTIONS && (
            <button className="btn btn-ghost btn-sm" onClick={() => setW({ ...w, actions: [...w.actions, newAction("post_channel")] })}>
              <Plus size={14} /> Add an action
            </button>
          )}
        </section>

        {props.catalog.unavailable.length > 0 && (
          <details className="faint" style={{ fontSize: 12.5 }}>
            <summary>Why some triggers aren't offered</summary>
            <ul>
              {props.catalog.unavailable.map((u) => (
                <li key={u.type}>
                  {u.type}: {u.reason}
                </li>
              ))}
            </ul>
          </details>
        )}

        {problems.length > 0 && (
          <ul className="wf-problems" aria-live="polite">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        {test && (
          <div className="banner info" role="status" style={{ display: "grid", gap: 4 }}>
            <strong>Test (nothing was changed)</strong>
            <span>{test.conditionsHoldForSample ? "The conditions hold for a sample event." : "The conditions don't hold for a sample event, so nothing would run for it."}</span>
            {test.outcomes.map((o, i) => (
              <span key={i}>
                Action {i + 1}: {o.status.replace("_", " ")} · {o.detail}
              </span>
            ))}
          </div>
        )}
        {act.error && (
          <div className="banner danger" role="alert">
            {act.error}
          </div>
        )}
        <small className="faint">Saving makes you its owner: it runs with your rights, and stops if you lose them.</small>
      </div>
    </Dialog>
  );
}

function ChannelPick({ channels, value, onChange }: { channels: Conversation[]; value: string; onChange: (id: string) => void }) {
  return (
    <select className="input" aria-label="Channel" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Pick a channel…</option>
      {channels.map((c) => (
        <option key={c.id} value={c.id}>
          #{c.name}
        </option>
      ))}
    </select>
  );
}
