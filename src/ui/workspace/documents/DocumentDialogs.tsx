import { Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { useEngine } from "../../../app/orbit";
import {
  ACCESS,
  ACCESS_LABEL,
  DEFAULT_ROLES,
  type Doc,
  type DocAccess,
  type DocRole,
  DOC_ROLES,
  documentVersion,
  documentVersions,
  restoreVersion,
  ROLE_LABEL,
  shareDocument,
  type Sharing,
} from "../../../sync/documents";
import { directory, workspaceChannels } from "../../../sync/workspaces";
import { Dialog } from "../../components/Overlay";
import { fullTime } from "../../format";
import { useAction, useLoad } from "../useLoad";
import { ErrorLine } from "../WorkspaceView";
import { MarkdownView } from "./MarkdownView";

/** Every saved version (newest 50 kept): read one, or bring it back as a new revision (nothing is lost). */
export function VersionsDialog({ doc, canRestore, onRestored, onClose }: { doc: Doc; canRestore: boolean; onRestored: () => void; onClose: () => void }) {
  const engine = useEngine();
  const versions = useLoad(() => documentVersions(engine, doc.id), [engine, doc.id]);
  const [rev, setRev] = useState<number | null>(null);
  const shown = useLoad(() => (rev ? documentVersion(engine, doc.id, rev) : Promise.resolve(null)), [engine, doc.id, rev]);
  const act = useAction();
  return (
    <Dialog title="Versions" wide onClose={onClose}>
      <div className="dialog-body doc-versions">
        <ErrorLine text={versions.error ?? act.error} />
        <ul className="ws-list">
          {(versions.data ?? []).map((v) => (
            <li key={v.rev}>
              <button className="list-row" aria-pressed={rev === v.rev} onClick={() => setRev(v.rev)}>
                <span className="lines">
                  <strong>
                    Version {v.rev}
                    {v.rev === doc.rev ? " (current)" : ""}
                  </strong>
                  <small>
                    {fullTime(v.createdAt)} · {v.author.name ?? "Someone"}
                  </small>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {shown.data && (
          <div className="card doc-card">
            <h2 className="doc-title">{shown.data.title}</h2>
            <MarkdownView text={shown.data.content} />
            {canRestore && shown.data.rev !== doc.rev && (
              <button
                className="btn btn-secondary btn-sm"
                disabled={act.busy}
                onClick={() =>
                  void act.act(async () => {
                    await restoreVersion(engine, doc.id, shown.data!.rev);
                    onRestored();
                    onClose();
                  })
                }
              >
                Bring this version back
              </button>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}

/** Who may open the document and with what role (admins only); the server checks every rule again. */
export function SharingDialog({ doc, orgId, onSaved, onClose }: { doc: Doc; orgId: string; onSaved: () => void; onClose: () => void }) {
  const engine = useEngine();
  const channels = useLoad(() => workspaceChannels(engine, orgId, false), [engine, orgId]);
  const [s, setS] = useState<Sharing>({
    access: doc.access,
    defaultRole: (DEFAULT_ROLES as readonly string[]).includes(doc.defaultRole) ? (doc.defaultRole as Sharing["defaultRole"]) : "comment",
    channelId: doc.channel?.id ?? null,
    members: doc.members.map((m) => ({ userId: m.userId, role: m.role })),
  });
  const [names, setNames] = useState<Record<string, string>>(Object.fromEntries(doc.members.map((m) => [m.userId, m.name ?? m.username])));
  const [q, setQ] = useState("");
  const found = useLoad(() => (q.trim().length >= 2 ? directory(engine, orgId, q) : Promise.resolve([])), [engine, orgId, q]);
  const act = useAction();
  const setRole = (userId: string, role: DocRole) => setS({ ...s, members: s.members.map((m) => (m.userId === userId ? { ...m, role } : m)) });
  return (
    <Dialog
      title="Share"
      onClose={onClose}
      footer={
        <button
          className="btn btn-primary"
          disabled={act.busy || (s.access === "channel" && !s.channelId)}
          onClick={() =>
            void act.act(async () => {
              await shareDocument(engine, doc.id, { ...s, channelId: s.access === "channel" ? s.channelId : null });
              onSaved();
              onClose();
            })
          }
        >
          Save
        </button>
      }
    >
      <div className="dialog-body">
        <label className="field">
          <span>Who can open it</span>
          <select className="input" value={s.access} onChange={(e) => setS({ ...s, access: e.target.value as DocAccess })}>
            {ACCESS.map((a) => (
              <option key={a} value={a}>
                {ACCESS_LABEL[a]}
              </option>
            ))}
          </select>
        </label>
        {s.access === "channel" && (
          <label className="field">
            <span>Channel</span>
            <select className="input" value={s.channelId ?? ""} onChange={(e) => setS({ ...s, channelId: e.target.value || null })}>
              <option value="">Pick a channel…</option>
              {(channels.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {s.access !== "restricted" && (
          <label className="field">
            <span>They</span>
            <select className="input" value={s.defaultRole} onChange={(e) => setS({ ...s, defaultRole: e.target.value as Sharing["defaultRole"] })}>
              {DEFAULT_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r].toLowerCase()}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="field">
          <span>People added</span>
          <ul className="ws-list">
            {s.members.map((m) => (
              <li key={m.userId} className="ws-row">
                <span className="grow ellipsis">{names[m.userId] ?? m.userId}</span>
                <select className="input input-sm" value={m.role} onChange={(e) => setRole(m.userId, e.target.value as DocRole)} aria-label={`Role of ${names[m.userId] ?? "this person"}`}>
                  {DOC_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
                <button className="icon-btn" aria-label="Remove" onClick={() => setS({ ...s, members: s.members.filter((x) => x.userId !== m.userId) })}>
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add someone from the workspace" aria-label="Find someone to add" />
          <ul className="ws-list">
            {(found.data ?? [])
              .filter((p) => !s.members.some((m) => m.userId === p.id))
              .slice(0, 6)
              .map((p) => (
                <li key={p.id}>
                  <button
                    className="list-row"
                    onClick={() => {
                      setNames({ ...names, [p.id]: p.displayName });
                      setS({ ...s, members: [...s.members, { userId: p.id, role: "comment" }] });
                      setQ("");
                    }}
                  >
                    <UserPlus size={15} className="faint" /> {p.displayName} <small className="faint">@{p.username}</small>
                  </button>
                </li>
              ))}
          </ul>
        </div>
        <small className="faint">Leaving the workspace ends access at once, whatever is listed here.</small>
        <ErrorLine text={act.error} />
      </div>
    </Dialog>
  );
}
