import { FileText, LockOpen, Plus } from "lucide-react";
import { useState } from "react";
import type { OrgAdminDetail } from "../../../api/workspaceSchemas";
import { useEngine } from "../../../app/orbit";
import { navigate } from "../../../app/router";
import { ACCESS, ACCESS_LABEL, createDocument, type DocAccess, DEFAULT_ROLES, docTemplates, listDocuments, MAX_TITLE, ROLE_LABEL } from "../../../sync/documents";
import { workspaceChannels } from "../../../sync/workspaces";
import { Dialog } from "../../components/Overlay";
import { relative } from "../../format";
import { useAction, useLoad } from "../useLoad";
import { Card, ErrorLine } from "../WorkspaceView";
import { DocumentScreen } from "./DocumentScreen";

/** The label every list and document carries (server docs/DOCUMENTS.md › Encryption: the owner's decision). */
export function NotE2ee() {
  return (
    <span className="tag doc-plain" title="Documents are stored readable by the server so they can be searched. Messages, files and calls stay end-to-end encrypted.">
      <LockOpen size={11} /> Not end-to-end encrypted
    </span>
  );
}

/**
 * Workspace › Documents (android round 7 C4 DocumentsScreen): documents this person may read, active or archived, and
 * a new one from a template with who may see it. A document id in the address opens it.
 */
export function DocumentsPage({ detail, docId }: { detail: OrgAdminDetail; docId: string | null }) {
  const engine = useEngine();
  const orgId = detail.org.id;
  const [archived, setArchived] = useState(false);
  const [making, setMaking] = useState(false);
  const list = useLoad(() => listDocuments(engine, orgId, archived), [engine, orgId, archived, docId]);
  if (docId) return <DocumentScreen docId={docId} orgId={orgId} />;
  return (
    <div className="ws-page">
      <Card
        title="Documents"
        sub={
          <>
            Pages your workspace writes together: briefs, notes, guides, procedures. <NotE2ee />
          </>
        }
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => setMaking(true)} disabled={detail.org.myRole === "GUEST"}>
            <Plus size={14} /> New document
          </button>
        }
      >
        <div className="segmented" role="tablist" aria-label="Show">
          <button role="tab" aria-selected={!archived} onClick={() => setArchived(false)}>
            Active
          </button>
          <button role="tab" aria-selected={archived} onClick={() => setArchived(true)}>
            Archived
          </button>
        </div>
        <ErrorLine text={list.error} />
        {list.data?.length === 0 && <p className="faint">{archived ? "Nothing archived." : "No documents yet."}</p>}
        <ul className="ws-list">
          {(list.data ?? []).map((d) => (
            <li key={d.id}>
              <button className="list-row" onClick={() => navigate({ section: "workspace", workspacePage: "documents", itemId: d.id })}>
                <FileText size={18} className="faint" />
                <span className="lines">
                  <strong className="ellipsis">{d.title}</strong>
                  <small className="ellipsis">
                    {d.access === "channel" && d.channel ? `#${d.channel.name}` : ACCESS_LABEL[d.access]} · {ROLE_LABEL[d.role].toLowerCase()} · updated {relative(d.updatedAt)}
                    {d.updatedBy.name ? ` by ${d.updatedBy.name}` : ""}
                  </small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
      {making && <NewDocumentDialog orgId={orgId} onClose={() => setMaking(false)} />}
    </div>
  );
}

function NewDocumentDialog({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const engine = useEngine();
  const templates = useLoad(() => docTemplates(engine), [engine]);
  const channels = useLoad(() => workspaceChannels(engine, orgId, false), [engine, orgId]);
  const [template, setTemplate] = useState("blank");
  const [title, setTitle] = useState("");
  const [access, setAccess] = useState<DocAccess>("workspace");
  const [defaultRole, setDefaultRole] = useState<(typeof DEFAULT_ROLES)[number]>("comment");
  const [channelId, setChannelId] = useState("");
  const act = useAction();
  const tpl = templates.data?.find((t) => t.id === template);
  const name = title.trim() || (tpl && tpl.id !== "blank" ? tpl.title : "");
  const ok = !!name && (access !== "channel" || !!channelId);
  const create = () =>
    void act.act(async () => {
      const d = await createDocument(engine, orgId, { title: name, content: tpl?.content ?? "", access, defaultRole, channelId: access === "channel" ? channelId : null, members: [] });
      onClose();
      navigate({ section: "workspace", workspacePage: "documents", itemId: d.id });
    });
  return (
    <Dialog
      title="New document"
      onClose={onClose}
      footer={
        <button className="btn btn-primary" disabled={!ok || act.busy} onClick={create}>
          {act.busy ? "Creating…" : "Create"}
        </button>
      }
    >
      <div className="dialog-body">
        <label className="field">
          <span>Start from</span>
          <select className="input" value={template} onChange={(e) => setTemplate(e.target.value)}>
            {(templates.data ?? [{ id: "blank", title: "Untitled", content: "" }]).map((t) => (
              <option key={t.id} value={t.id}>
                {t.id === "blank" ? "Blank" : t.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Title</span>
          <input className="input" value={title} maxLength={MAX_TITLE} onChange={(e) => setTitle(e.target.value)} placeholder={tpl && tpl.id !== "blank" ? tpl.title : "Untitled"} />
        </label>
        <label className="field">
          <span>Who can open it</span>
          <select className="input" value={access} onChange={(e) => setAccess(e.target.value as DocAccess)}>
            {ACCESS.map((a) => (
              <option key={a} value={a}>
                {ACCESS_LABEL[a]}
              </option>
            ))}
          </select>
        </label>
        {access === "channel" && (
          <label className="field">
            <span>Channel</span>
            <select className="input" value={channelId} onChange={(e) => setChannelId(e.target.value)}>
              <option value="">Pick a channel…</option>
              {(channels.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {access !== "restricted" ? (
          <label className="field">
            <span>They</span>
            <select className="input" value={defaultRole} onChange={(e) => setDefaultRole(e.target.value as (typeof DEFAULT_ROLES)[number])}>
              {DEFAULT_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r].toLowerCase()}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <small className="faint">Only people you add can open it, not even the workspace's owners and admins. You can add people after creating it.</small>
        )}
        <small className="faint">
          <NotE2ee /> The server can read documents so they can be searched; messages, files and calls stay end-to-end encrypted.
        </small>
        <ErrorLine text={act.error} />
      </div>
    </Dialog>
  );
}
