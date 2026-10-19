import { MoreHorizontal, Search } from "lucide-react";
import { useState } from "react";
import type { DirectoryMember, OrgAdminDetail, OrgRole } from "../../api/workspaceSchemas";
import { useEngine } from "../../app/orbit";
import { changeMember, directory, removeMember } from "../../sync/workspaces";
import { assignableRoles, removalAllowed, roleName, titleChangeAllowed } from "../../sync/workspaceRules";
import { UserAvatar } from "../components/OrgAvatar";
import { Dialog, Menu, type MenuEntry, useMenu } from "../components/Overlay";
import { useAction, useLoad } from "./useLoad";
import { Card, ErrorLine } from "./WorkspaceView";

/** The member directory: roles, titles and removals, offered by the server's rules (server/src/roles.ts). */
export function PeoplePage({ detail }: { detail: OrgAdminDetail }) {
  const engine = useEngine();
  const orgId = detail.org.id;
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [version, setVersion] = useState(0);
  const people = useLoad(() => (detail.permissions.canViewDirectory ? directory(engine, orgId, term) : Promise.resolve([])), [engine, orgId, term, version, detail]);
  const myRole = (detail.org.myRole ?? "MEMBER") as OrgRole;
  const owners = (people.data ?? []).filter((m) => m.orgRole === "OWNER").length;

  if (!detail.permissions.canViewDirectory) {
    return <Card title="People" sub="Guests can't browse the workspace directory. People you share channels with appear in those channels' details." />;
  }

  return (
    <div className="ws-page">
      <Card title="People" sub={`${detail.stats.members} ${detail.stats.members === 1 ? "member" : "members"}. Owners and admins manage roles; everyone may set their own title.`}>
        <form
          className="row input"
          style={{ padding: "0 12px" }}
          onSubmit={(e) => {
            e.preventDefault();
            setTerm(q);
          }}
        >
          <Search size={16} className="faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onBlur={() => setTerm(q)}
            placeholder="Search by name or @username"
            aria-label="Search people"
            style={{ border: 0, outline: "none", background: "transparent", flex: 1, padding: "10px 0" }}
          />
        </form>
        <ErrorLine text={people.error} />
        <ul className="ws-list" aria-label="Members" aria-busy={people.loading}>
          {(people.data ?? []).map((m) => (
            <MemberRow key={m.id} member={m} orgId={orgId} myRole={myRole} myId={engine.device.userId} owners={owners} onChanged={() => setVersion((v) => v + 1)} />
          ))}
          {people.data?.length === 0 && <li className="faint">No one matches.</li>}
        </ul>
      </Card>
    </div>
  );
}

function MemberRow({ member: m, orgId, myRole, myId, owners, onChanged }: { member: DirectoryMember; orgId: string; myRole: OrgRole; myId: string; owners: number; onChanged: () => void }) {
  const engine = useEngine();
  const menu = useMenu();
  const act = useAction();
  const [editing, setEditing] = useState<"title" | "remove" | null>(null);
  const self = m.id === myId;
  const role = (m.orgRole ?? "MEMBER") as OrgRole;
  const roles = assignableRoles(myRole, role, self, owners);
  const canTitle = titleChangeAllowed(myRole, role, self);
  const canRemove = !self && removalAllowed(myRole, role, owners);
  const entries: MenuEntry[] = [
    ...(roles.length ? [{ heading: "Role" } as const] : []),
    ...roles.map((r) => ({
      label: `Make ${roleName(r).toLowerCase()}`,
      onSelect: () => void act.act(() => changeMember(engine, orgId, m.id, { role: r }).then(onChanged)),
    })),
    ...(canTitle ? [{ label: "Edit title…", onSelect: () => setEditing("title") }] : []),
    ...(canRemove ? ["separator" as const, { label: "Remove from workspace…", danger: true, onSelect: () => setEditing("remove") }] : []),
  ];
  return (
    <li className="ws-row">
      <UserAvatar userId={m.id} name={m.displayName} colorIndex={m.avatarColor} photoRev={m.photoRev} size={36} online={m.online} decorative />
      <span className="lines grow">
        <span className="ellipsis">
          {m.displayName}
          {self && <span className="faint"> (you)</span>}
        </span>
        <small className="ellipsis">
          @{m.username}
          {m.title ? ` · ${m.title}` : ""}
        </small>
      </span>
      <span className={`role-badge role-${role.toLowerCase()}`}>{roleName(role)}</span>
      {entries.length > 0 ? (
        <button className="icon-btn" aria-label={`Manage ${m.displayName}`} aria-haspopup="menu" onClick={(e) => menu.open(e.currentTarget)} disabled={act.busy}>
          <MoreHorizontal size={18} />
        </button>
      ) : (
        <span style={{ width: 34 }} />
      )}
      {menu.anchor && <Menu anchor={menu.anchor} entries={entries} onClose={menu.close} align="end" label={`Manage ${m.displayName}`} />}
      {act.error && (
        <div className="ws-row-error" role="alert">
          {act.error}
        </div>
      )}
      {editing === "title" && <TitleDialog member={m} orgId={orgId} onClose={() => setEditing(null)} onSaved={onChanged} />}
      {editing === "remove" && (
        <Dialog title={`Remove ${m.displayName}?`} onClose={() => setEditing(null)}>
          <div className="dialog-body">
            <p style={{ margin: 0 }}>They'll lose access to this workspace's channels, branches and teams. Direct messages with them stay.</p>
            <ErrorLine text={act.error} />
            <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                disabled={act.busy}
                onClick={() =>
                  void act.act(async () => {
                    await removeMember(engine, orgId, m.id);
                    setEditing(null);
                    onChanged();
                  })
                }
              >
                Remove
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </li>
  );
}

function TitleDialog({ member, orgId, onClose, onSaved }: { member: DirectoryMember; orgId: string; onClose: () => void; onSaved: () => void }) {
  const engine = useEngine();
  const [title, setTitle] = useState(member.title ?? "");
  const act = useAction();
  return (
    <Dialog title={`Title for ${member.displayName}`} onClose={onClose}>
      <form
        className="dialog-body"
        onSubmit={(e) => {
          e.preventDefault();
          void act.act(async () => {
            await changeMember(engine, orgId, member.id, { title: title.trim() || null });
            onSaved();
            onClose();
          });
        }}
      >
        <input className="input" data-autofocus value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Head of design" aria-label="Title" />
        <ErrorLine text={act.error} />
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={act.busy}>
            Save
          </button>
        </div>
      </form>
    </Dialog>
  );
}
