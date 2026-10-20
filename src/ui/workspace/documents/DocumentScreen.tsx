import { Archive, ArchiveRestore, ArrowLeft, Download, History, MessageSquare, Pencil, Share2, Trash2 } from "lucide-react";
import { useState } from "react";
import { ApiError } from "../../../api/client";
import { useEngine } from "../../../app/orbit";
import { navigate } from "../../../app/router";
import {
  ACCESS_LABEL,
  addComment,
  atLeast,
  deleteComment,
  deleteDocument,
  type Doc,
  documentComments,
  exportMarkdown,
  getDocument,
  MAX_CONTENT,
  MAX_TITLE,
  resolveComment,
  ROLE_LABEL,
  saveDocument,
  setDocumentArchived,
} from "../../../sync/documents";
import { relative } from "../../format";
import { useAction, useLoad } from "../useLoad";
import { ErrorLine } from "../WorkspaceView";
import { NotE2ee } from "./DocumentsPage";
import { MarkdownView } from "./MarkdownView";
import { SharingDialog, VersionsDialog } from "./DocumentDialogs";

/**
 * One document (android round 7 C4 DocumentScreen): read in the Markdown subset, edit on its revision (someone else's
 * save meanwhile is refused, not overwritten), comments, versions, sharing for admins, archive, delete and export.
 */
export function DocumentScreen({ docId, orgId }: { docId: string; orgId: string }) {
  const engine = useEngine();
  const [tick, setTick] = useState(0);
  const loaded = useLoad(() => getDocument(engine, docId), [engine, docId, tick]);
  const [editing, setEditing] = useState<{ title: string; content: string } | null>(null);
  const [panel, setPanel] = useState<"comments" | null>(null);
  const [dialog, setDialog] = useState<"versions" | "sharing" | null>(null);
  const [stale, setStale] = useState(false);
  const act = useAction();
  const d = loaded.data;
  const back = () => navigate({ section: "workspace", workspacePage: "documents" });
  const reload = () => setTick((t) => t + 1);

  if (!d)
    return (
      <div className="ws-page">
        <button className="btn btn-ghost btn-sm" onClick={back}>
          <ArrowLeft size={14} /> Documents
        </button>
        {loaded.error ? (
          <ErrorLine text={loaded.error.includes("not found") || loaded.error.includes("Not found") ? "This document doesn't exist or isn't shared with you." : loaded.error} />
        ) : (
          <div className="skeleton" style={{ height: 200 }} aria-busy="true" />
        )}
      </div>
    );

  const canEdit = atLeast(d.role, "edit") && !d.archived;
  const admin = atLeast(d.role, "admin");
  const save = () =>
    void act.act(async () => {
      try {
        await saveDocument(engine, d.id, d.rev, editing!.title, editing!.content);
        setEditing(null);
        setStale(false);
        reload();
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) setStale(true);
        else throw e;
      }
    });
  const exportIt = () => {
    const url = URL.createObjectURL(new Blob([exportMarkdown(d)], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(d.title.replace(/[^\p{L}\p{N} ._-]+/gu, "").trim() || "document").slice(0, 80)}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  return (
    <div className="ws-page doc-page">
      <div className="row doc-toolbar">
        <button className="btn btn-ghost btn-sm" onClick={back}>
          <ArrowLeft size={14} /> Documents
        </button>
        <span className="grow" />
        {!editing && canEdit && (
          <button className="btn btn-secondary btn-sm" onClick={() => setEditing({ title: d.title, content: d.content })}>
            <Pencil size={14} /> Edit
          </button>
        )}
        <button className="btn btn-ghost btn-sm" aria-pressed={panel === "comments"} onClick={() => setPanel(panel === "comments" ? null : "comments")}>
          <MessageSquare size={14} /> Comments
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setDialog("versions")}>
          <History size={14} /> Versions
        </button>
        {admin && (
          <button className="btn btn-ghost btn-sm" onClick={() => setDialog("sharing")}>
            <Share2 size={14} /> Share
          </button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={exportIt} title="Download as Markdown">
          <Download size={14} /> Export
        </button>
        {admin && (
          <button className="btn btn-ghost btn-sm" disabled={act.busy} onClick={() => void act.act(() => setDocumentArchived(engine, d.id, !d.archived).then(reload))}>
            {d.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />} {d.archived ? "Restore" : "Archive"}
          </button>
        )}
        {admin && d.archived && (
          <button className="btn btn-ghost btn-sm danger-text" disabled={act.busy} onClick={() => void act.act(() => deleteDocument(engine, d.id).then(back))}>
            <Trash2 size={14} /> Delete
          </button>
        )}
      </div>

      <div className={`doc-layout${panel ? " with-panel" : ""}`}>
        <article className="card doc-card">
          {editing ? (
            <div className="doc-editor">
              <input className="input doc-title-input" value={editing.title} maxLength={MAX_TITLE} onChange={(e) => setEditing({ ...editing, title: e.target.value })} aria-label="Title" />
              <textarea className="input mono" value={editing.content} maxLength={MAX_CONTENT} onChange={(e) => setEditing({ ...editing, content: e.target.value })} aria-label="Text" rows={18} />
              <small className="faint"># headings, - lists, - [ ] to-dos, &gt; quotes, **bold**, `code`</small>
              {stale && (
                <div className="banner warn" role="alert">
                  <span className="grow">Someone saved this document meanwhile. Copy your changes, reload to see theirs, then edit again.</span>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setStale(false);
                      setEditing(null);
                      reload();
                    }}
                  >
                    Reload
                  </button>
                </div>
              )}
              <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-secondary" onClick={() => setEditing(null)}>
                  Cancel
                </button>
                <button className="btn btn-primary" disabled={act.busy || !editing.title.trim()} onClick={save}>
                  {act.busy ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="doc-title">{d.title}</h1>
              <p className="faint doc-meta">
                {d.access === "channel" && d.channel ? `Members of #${d.channel.name}` : ACCESS_LABEL[d.access]} · you {ROLE_LABEL[d.role].toLowerCase()} · updated {relative(d.updatedAt)}
                {d.updatedBy.name ? ` by ${d.updatedBy.name}` : ""} {d.archived && <span className="tag">Archived: read-only</span>} <NotE2ee />
              </p>
              <MarkdownView text={d.content} />
            </>
          )}
          <ErrorLine text={act.error} />
        </article>
        {panel === "comments" && <CommentsPanel doc={d} />}
      </div>

      {dialog === "versions" && <VersionsDialog doc={d} canRestore={canEdit} onRestored={reload} onClose={() => setDialog(null)} />}
      {dialog === "sharing" && <SharingDialog doc={d} orgId={orgId} onSaved={reload} onClose={() => setDialog(null)} />}
    </div>
  );
}

function CommentsPanel({ doc }: { doc: Doc }) {
  const engine = useEngine();
  const [tick, setTick] = useState(0);
  const comments = useLoad(() => documentComments(engine, doc.id), [engine, doc.id, tick]);
  const [body, setBody] = useState("");
  const [quote, setQuote] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  const act = useAction();
  const can = atLeast(doc.role, "comment") && !doc.archived;
  const reload = () => setTick((t) => t + 1);
  const list = (comments.data ?? []).filter((c) => showResolved || !c.resolved);
  return (
    <aside className="card doc-comments" aria-label="Comments">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong>Comments</strong>
        <label className="row" style={{ gap: 6, fontSize: 12.5 }}>
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} /> Show resolved
        </label>
      </div>
      <ErrorLine text={comments.error ?? act.error} />
      {list.length === 0 && <p className="faint">No comments{showResolved ? "" : " open"}.</p>}
      <ul className="doc-comment-list">
        {list.map((c) => (
          <li key={c.id} className={c.resolved ? "resolved" : undefined}>
            {c.quote && <blockquote>{c.quote}</blockquote>}
            <p>{c.body}</p>
            <small className="faint">
              {c.author.name ?? "Someone"} · {relative(c.createdAt)}
            </small>
            <div className="row" style={{ gap: 4 }}>
              {can && (
                <button className="btn btn-ghost btn-sm" disabled={act.busy} onClick={() => void act.act(() => resolveComment(engine, c.id, !c.resolved).then(reload))}>
                  {c.resolved ? "Reopen" : "Resolve"}
                </button>
              )}
              {c.canDelete && (
                <button className="btn btn-ghost btn-sm" disabled={act.busy} onClick={() => void act.act(() => deleteComment(engine, c.id).then(reload))}>
                  Delete
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {can && (
        <form
          className="doc-comment-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!body.trim()) return;
            void act.act(async () => {
              await addComment(engine, doc.id, body.trim(), quote.trim() || null);
              setBody("");
              setQuote("");
              reload();
            });
          }}
        >
          <input className="input" value={quote} maxLength={300} onChange={(e) => setQuote(e.target.value)} placeholder="Quote a passage (optional)" aria-label="Quoted passage" />
          <textarea className="input" rows={3} value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} placeholder="Add a comment" aria-label="Comment" />
          <button className="btn btn-primary btn-sm" disabled={!body.trim() || act.busy}>
            Comment
          </button>
        </form>
      )}
    </aside>
  );
}
