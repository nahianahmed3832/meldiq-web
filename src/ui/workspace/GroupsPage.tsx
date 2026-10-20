import { Pencil, Plus, Trash2, UsersRound, X } from "lucide-react";
import { useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine } from "../../app/orbit";
import { createGroup, deleteGroup, type Group, listGroups, updateGroup } from "../../sync/workspaceC5";
import { directory } from "../../sync/workspaces";
import { Dialog } from "../components/Overlay";
import { useAction, useLoad } from "./useLoad";
import { Card, ErrorLine } from "./WorkspaceView";

/**
 * Workspace › Groups (android round 7 C5 GroupsScreen): named sets of members with a handle. A group grants nothing by
 * itself: adding it to a channel or meeting adds its current members, each checked one by one. Members see groups;
 * `groups.manage` changes them.
 */
export function GroupsPage({ detail }: { detail: OrgAdminDetail }) {
  const engine = useEngine();
  const orgId = detail.org.id;
  const canManage = detail.permissions.canManageGroups;
  const [tick, setTick] = useState(0);
  const groups = useLoad(() => listGroups(engine, orgId), [engine, orgId, tick]);
  const [editing, setEditing] = useState<Group | "new" | null>(null);
  const act = useAction();
  const reload = () => setTick((t) => t + 1);
  return (
    <div className="ws-page">
      <Card
        title="Groups"
        sub="Named sets of people, like Marketing or Engineering. Adding a group to a channel or meeting adds its current members; a group gives no access by itself."
        actions={
          canManage && (
            <button className="btn btn-primary btn-sm" onClick={() => setEditing("new")}>
              <Plus size={14} /> New group
            </button>
          )
        }
      >
        <ErrorLine text={groups.error ?? act.error} />
        {groups.data?.length === 0 && <p className="faint">No groups yet.</p>}
        <ul className="ws-list">
          {(groups.data ?? []).map((g) => (
            <li key={g.id} className="ws-row">
              <UsersRound size={18} className="faint" />
              <span className="lines grow">
                <strong>
                  {g.name} <span className="faint">@{g.handle}</span>
                </strong>
                <small className="ellipsis">
                  {g.members.length === 1 ? "1 member" : `${g.members.length} members`}
                  {g.members.length ? `: ${g.members.map((m) => m.name ?? m.username).join(", ")}` : ""}
                  {g.description ? ` · ${g.description}` : ""}
                </small>
              </span>
              {canManage && (
                <>
                  <button className="icon-btn" aria-label={`Edit ${g.name}`} onClick={() => setEditing(g)}>
                    <Pencil size={15} />
                  </button>
                  <button className="icon-btn" aria-label={`Delete ${g.name}`} disabled={act.busy} onClick={() => void act.act(() => deleteGroup(engine, orgId, g.id).then(reload))}>
                    <Trash2 size={15} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </Card>
      {editing && (
        <GroupDialog
          orgId={orgId}
          group={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function GroupDialog({ orgId, group, onClose, onSaved }: { orgId: string; group: Group | null; onClose: () => void; onSaved: () => void }) {
  const engine = useEngine();
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [members, setMembers] = useState<{ id: string; name: string }[]>(group?.members.map((m) => ({ id: m.id, name: m.name ?? m.username })) ?? []);
  const [q, setQ] = useState("");
  const found = useLoad(() => (q.trim().length >= 2 ? directory(engine, orgId, q) : Promise.resolve([])), [engine, orgId, q]);
  const act = useAction();
  const input = { name: name.trim(), description: description.trim() || null, memberIds: members.map((m) => m.id) };
  return (
    <Dialog
      title={group ? `Edit ${group.name}` : "New group"}
      onClose={onClose}
      footer={
        <button
          className="btn btn-primary"
          disabled={!input.name || act.busy}
          onClick={() => void act.act(() => (group ? updateGroup(engine, orgId, group.id, input) : createGroup(engine, orgId, input)).then(onSaved))}
        >
          Save
        </button>
      }
    >
      <div className="dialog-body">
        <label className="field">
          <span>Name</span>
          <input className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. Marketing" />
        </label>
        <label className="field">
          <span>Description (optional)</span>
          <input className="input" value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="field">
          <span>Members</span>
          <div className="wf-channels">
            {members.map((m) => (
              <span key={m.id} className="chip">
                {m.name}
                <button className="icon-btn" style={{ width: 18, height: 18 }} aria-label={`Remove ${m.name}`} onClick={() => setMembers(members.filter((x) => x.id !== m.id))}>
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add people from the workspace" aria-label="Find someone to add" />
          <ul className="ws-list">
            {(found.data ?? [])
              .filter((p) => !members.some((m) => m.id === p.id) && p.orgRole !== "GUEST")
              .slice(0, 6)
              .map((p) => (
                <li key={p.id}>
                  <button
                    className="list-row"
                    onClick={() => {
                      setMembers([...members, { id: p.id, name: p.displayName }]);
                      setQ("");
                    }}
                  >
                    {p.displayName} <small className="faint">@{p.username}</small>
                  </button>
                </li>
              ))}
          </ul>
        </div>
        <ErrorLine text={act.error} />
      </div>
    </Dialog>
  );
}
