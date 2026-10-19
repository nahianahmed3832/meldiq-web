import { TransferOwnership } from "./TransferOwnership";
import { Camera, LogOut, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine } from "../../app/orbit";
import { setPrefs } from "../../app/prefs";
import { navigate } from "../../app/router";
import { deleteWorkspace, leaveWorkspace, removeWorkspacePhoto, requestId, setWorkspacePhoto, updateWorkspace } from "../../sync/workspaces";
import { roleName } from "../../sync/workspaceRules";
import { OrgAvatar } from "../components/OrgAvatar";
import { Dialog } from "../components/Overlay";
import { squareJpeg } from "./photo";
import { useAction } from "./useLoad";
import { Card, ErrorLine } from "./WorkspaceView";

export function OverviewPage({ detail, onChanged }: { detail: OrgAdminDetail; onChanged: () => void }) {
  const { org, permissions: can, stats } = detail;
  return (
    <div className="ws-page">
      <header className="ws-hero">
        <OrgAvatar orgId={org.id} name={org.name} photoRev={org.photoRev} size={64} />
        <div className="grow">
          <h1>{org.name}</h1>
          <p className="muted">
            {roleName(org.myRole)} · {stats.members} {stats.members === 1 ? "member" : "members"} · {stats.channels} channels · {stats.branches} branches · {stats.teams} teams
          </p>
        </div>
      </header>
      {can.canManageOrg ? <Identity detail={detail} onChanged={onChanged} /> : <ReadOnlyAbout description={org.description} />}
      <TransferOwnership detail={detail} onChanged={onChanged} />
      <Membership detail={detail} />
    </div>
  );
}

function ReadOnlyAbout({ description }: { description: string | null }) {
  return (
    <Card title="About" sub="Only owners and admins can change the workspace's name, description and photo.">
      <p style={{ margin: 0 }}>{description || <span className="faint">No description.</span>}</p>
    </Card>
  );
}

function Identity({ detail, onChanged }: { detail: OrgAdminDetail; onChanged: () => void }) {
  const engine = useEngine();
  const { org } = detail;
  const [name, setName] = useState(org.name);
  const [description, setDescription] = useState(org.description ?? "");
  const save = useAction();
  const photo = useAction();
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setName(org.name);
    setDescription(org.description ?? "");
  }, [org.name, org.description]);
  const dirty = name.trim() !== org.name || (description.trim() || null) !== (org.description ?? null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    void save.act(() => updateWorkspace(engine, org.id, { name: name.trim(), description: description.trim() || null }));
  };

  const pick = (f: File | undefined) => {
    if (!f) return;
    void photo.act(async () => {
      await setWorkspacePhoto(engine, org.id, await squareJpeg(f));
      onChanged();
    });
  };

  return (
    <Card title="Workspace details" sub="Members see the name, description and photo. They aren't end-to-end encrypted.">
      <div className="row" style={{ gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <OrgAvatar orgId={org.id} name={org.name} photoRev={org.photoRev} size={56} />
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
        <button className="btn btn-secondary btn-sm" disabled={photo.busy} onClick={() => file.current?.click()}>
          <Camera size={14} /> {org.photoRev ? "Change photo" : "Add photo"}
        </button>
        {org.photoRev && (
          <button className="btn btn-ghost btn-sm" disabled={photo.busy} onClick={() => void photo.act(() => removeWorkspacePhoto(engine, org.id).then(onChanged))}>
            Remove
          </button>
        )}
      </div>
      <ErrorLine text={photo.error} />
      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <div className="field">
          <label htmlFor="ws-name">Name</label>
          <input id="ws-name" className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ws-desc">Description</label>
          <textarea id="ws-desc" className="textarea" rows={2} value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <ErrorLine text={save.error} />
        <div>
          <button className="btn btn-primary btn-sm" disabled={!dirty || !name.trim() || save.busy}>
            {save.busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Card>
  );
}

function Membership({ detail }: { detail: OrgAdminDetail }) {
  const engine = useEngine();
  const { org, permissions: can } = detail;
  const leave = useAction();
  const [confirm, setConfirm] = useState<"leave" | "delete" | null>(null);
  return (
    <Card title="Your membership" sub="Leaving removes you from this workspace's branches, teams and channels. Your direct messages stay.">
      <ErrorLine text={leave.error} />
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-danger-quiet btn-sm" disabled={!can.canLeave || leave.busy} onClick={() => setConfirm("leave")}>
          <LogOut size={14} /> Leave workspace
        </button>
        {can.isOwner && (
          <button className="btn btn-danger-quiet btn-sm" onClick={() => setConfirm("delete")}>
            <Trash2 size={14} /> Delete workspace…
          </button>
        )}
      </div>
      {!can.canLeave && (
        <p className="faint" style={{ margin: 0, fontSize: 13 }}>
          You're the only owner. Make someone else an owner (People) before you leave.
        </p>
      )}
      {confirm === "leave" && (
        <Dialog title={`Leave ${org.name}?`} onClose={() => setConfirm(null)}>
          <div className="dialog-body">
            <p style={{ margin: 0 }}>You'll stop seeing its channels. To come back you'll need a new invitation.</p>
            <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                disabled={leave.busy}
                onClick={() =>
                  void leave.act(async () => {
                    await leaveWorkspace(engine, org.id);
                    setConfirm(null);
                    setPrefs({ orgId: null });
                    navigate({ section: "home" });
                  })
                }
              >
                Leave
              </button>
            </div>
          </div>
        </Dialog>
      )}
      {confirm === "delete" && <DeleteDialog orgId={org.id} name={org.name} onClose={() => setConfirm(null)} />}
    </Card>
  );
}

/** Owners only, after typing the exact name. Removes channels, branches, teams and invitations for everyone. */
function DeleteDialog({ orgId, name, onClose }: { orgId: string; name: string; onClose: () => void }) {
  const engine = useEngine();
  const reqId = useMemo(requestId, []);
  const [typed, setTyped] = useState("");
  const del = useAction();
  return (
    <Dialog title={`Delete ${name}?`} onClose={onClose}>
      <div className="dialog-body">
        <div className="banner danger">This deletes the workspace's channels and their messages and files, its branches, teams and invitations, for every member. It can't be undone.</div>
        <p style={{ margin: 0 }}>People's accounts, direct messages and groups stay. Type the workspace's name to confirm.</p>
        <input className="input" data-autofocus value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Workspace name" placeholder={name} />
        <ErrorLine text={del.error} />
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-danger"
            disabled={typed !== name || del.busy}
            onClick={() =>
              void del.act(async () => {
                await deleteWorkspace(engine, orgId, typed, reqId);
                onClose();
                setPrefs({ orgId: null });
                navigate({ section: "home" });
              })
            }
          >
            {del.busy ? "Deleting…" : "Delete workspace"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
