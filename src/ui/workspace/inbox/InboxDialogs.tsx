import { useState } from "react";
import { useEngine, useOrbit } from "../../../app/orbit";
import {
  claimInboxConversation,
  eraseInboxCustomer,
  handoffInboxConversation,
  inboxAgents,
  type InboxConversation,
  inboxQueues,
  inboxSettings,
  inboxTemplates,
  parseTags,
  PRIORITIES,
  PRIORITY_LABEL,
  sendInboxTemplate,
  updateInboxConversation,
} from "../../../sync/inbox";
import { Dialog } from "../../components/Overlay";
import { useAction, useLoad } from "../useLoad";
import { ErrorLine } from "../WorkspaceView";

/**
 * Ownership, queue, priority, tags and status; handing an AI conversation to a person; and, for inbox admins, erasing
 * the customer's data (android ActionsSheet). Every change carries the conversation's revision.
 */
export function InboxActionsDialog({ conversation: c, onClose, onChanged, onErased }: { conversation: InboxConversation; onClose: () => void; onChanged: () => void; onErased: () => void }) {
  const engine = useEngine();
  const me = useOrbit((s) => s.me?.userId ?? null);
  const agents = useLoad(() => inboxAgents(engine, c.orgId), [engine, c.orgId]);
  const queues = useLoad(() => inboxQueues(engine, c.orgId), [engine, c.orgId]);
  const canManage = useLoad(() => inboxSettings(engine, c.orgId).then((s) => s.canManage), [engine, c.orgId]).data === true;
  const [tags, setTags] = useState(c.tags.join(", "));
  const [confirmErase, setConfirmErase] = useState(false);
  const act = useAction();
  // A stale revision comes back as 409 with the server's own "someone else changed this conversation".
  const run = (fn: () => Promise<unknown>) => void act.act(() => fn().then(onChanged));
  const patch = (change: Parameters<typeof updateInboxConversation>[3]) => run(() => updateInboxConversation(engine, c.id, c.rev, change));
  return (
    <Dialog title="Conversation" onClose={onClose}>
      <div className="dialog-body">
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {c.assigneeId !== me && (
            <button className="btn btn-secondary btn-sm" disabled={act.busy} onClick={() => run(() => claimInboxConversation(engine, c.id))}>
              Take this conversation
            </button>
          )}
          {(c.handling === "ai_auto" || c.handling === "escalated") && (
            <button className="btn btn-secondary btn-sm" disabled={act.busy} onClick={() => run(() => handoffInboxConversation(engine, c.id))}>
              Hand over to a person
            </button>
          )}
        </div>
        <label className="field">
          <span>Assign to…</span>
          <select className="input" value={c.assigneeId ?? ""} disabled={act.busy} onChange={(e) => patch({ assigneeId: e.target.value })}>
            <option value="">Unassigned</option>
            {(agents.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.canReply ? "" : " (notes only)"}
              </option>
            ))}
          </select>
        </label>
        {(queues.data?.length ?? 0) > 0 && (
          <label className="field">
            <span>Queue</span>
            <select className="input" value={c.queueId ?? ""} disabled={act.busy} onChange={(e) => patch({ queueId: e.target.value })}>
              <option value="">No queue</option>
              {(queues.data ?? []).map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="field">
          <span>Priority</span>
          <span className="segmented" role="group" aria-label="Priority">
            {PRIORITIES.map((p) => (
              <button key={p} aria-pressed={c.priority === p} disabled={act.busy} onClick={() => patch({ priority: p })}>
                {PRIORITY_LABEL[p]}
              </button>
            ))}
          </span>
        </div>
        <div className="field">
          <span>Tags (comma-separated)</span>
          <div className="row" style={{ gap: 8 }}>
            <input className="input grow" value={tags} maxLength={330} onChange={(e) => setTags(e.target.value)} aria-label="Tags" />
            <button className="btn btn-secondary btn-sm" disabled={act.busy} onClick={() => patch({ tags: parseTags(tags) })}>
              Save tags
            </button>
          </div>
        </div>
        {c.status === "resolved" ? (
          <button className="btn btn-primary" disabled={act.busy} onClick={() => patch({ status: "waiting_agent" })}>
            Reopen
          </button>
        ) : (
          <button className="btn btn-primary" disabled={act.busy} onClick={() => patch({ status: "resolved" })}>
            Resolve
          </button>
        )}
        {canManage &&
          (confirmErase ? (
            <div className="banner danger" role="alert">
              <span className="grow">Deletes this conversation, its notes and the customer's record from this workspace. Messages already on Meta aren't affected.</span>
              <button className="btn btn-danger btn-sm" disabled={act.busy} onClick={() => void act.act(() => eraseInboxCustomer(engine, c.id).then(onErased))}>
                Erase
              </button>
            </div>
          ) : (
            <button className="btn btn-ghost btn-sm danger-text" style={{ justifySelf: "start" }} onClick={() => setConfirmErase(true)}>
              Erase this customer's data…
            </button>
          ))}
        <ErrorLine text={act.error} />
      </div>
    </Dialog>
  );
}

/** WhatsApp after 24 hours: only the business account's approved templates. */
export function InboxTemplateDialog({ conversation: c, onClose, onSent }: { conversation: InboxConversation; onClose: () => void; onSent: () => void }) {
  const engine = useEngine();
  const templates = useLoad(() => inboxTemplates(engine, c.orgId, c.account.id), [engine, c.orgId, c.account.id]);
  const act = useAction();
  return (
    <Dialog title="Send a template" onClose={onClose}>
      <div className="dialog-body">
        <ErrorLine text={templates.error ?? act.error} />
        {templates.data?.length === 0 && <p className="faint">No approved templates on this WhatsApp account.</p>}
        <ul className="ws-list">
          {(templates.data ?? []).map((t) => (
            <li key={`${t.name}:${t.language}`}>
              <button className="list-row" disabled={act.busy} onClick={() => void act.act(() => sendInboxTemplate(engine, c.id, t).then(onSent))}>
                <span className="lines">
                  <strong>{t.name}</strong>
                  <small className="faint">{[t.language, t.category].filter(Boolean).join(" · ")}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}
