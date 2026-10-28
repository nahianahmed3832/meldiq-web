import { MoreHorizontal, Search, UserPlus } from "lucide-react";
import { AddMembersDialog } from "./AddMembersDialog";
import { useState } from "react";
import type { DirectoryMember, OrgAdminDetail, OrgRole } from "../../api/workspaceSchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { changeMember, directory, removeMember } from "../../sync/workspaces";
import { setGuestExpiry } from "../../sync/workspaceC5";
import { assignableRoles, memberGroups, removalAllowed, roleName, titleChangeAllowed } from "../../sync/workspaceRules";
import { ban, setTimeout_ } from "../../sync/community";
import { running, TIMEOUT_CHOICES } from "../../sync/reports";
import { ReportDialog } from "../chat/ReportDialog";
import { untilWhen } from "../format";
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
  const [adding, setAdding] = useState(false);

  if (!detail.permissions.canViewDirectory) {
    return <Card title="People" sub="Guests can't browse the community directory. People you share channels with appear in those channels' details." />;
  }

  return (
    <div className="ws-page">
      <Card
        title="People"
        sub={`${detail.stats.members} ${detail.stats.members === 1 ? "member" : "members"}. Owners and admins manage roles; everyone may set their own title.`}
        actions={
          detail.permissions.canInvite && (
            <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
              <UserPlus size={16} /> Add members
            </button>
          )
        }
      >
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
        {memberGroups(people.data ?? []).map((g) => (
          <section key={g.role?.id ?? "members"} aria-label={g.role?.name ?? "Members"}>
            {(people.data ?? []).some((m) => m.customRoles.some((r) => r.hoist)) && (
              <h3 className="ws-subhead" style={g.role?.color ? { color: g.role.color } : undefined}>
                {g.role?.name ?? "Members"} — {g.members.length}
              </h3>
            )}
            <ul className="ws-list" aria-label={g.role?.name ?? "Members"} aria-busy={people.loading}>
              {g.members.map((m) => (
                <MemberRow key={m.id} member={m} detail={detail} myRole={myRole} myId={engine.device.userId} owners={owners} onChanged={() => setVersion((v) => v + 1)} />
              ))}
            </ul>
          </section>
        ))}
        {people.data?.length === 0 && <p className="faint">No one matches.</p>}
      </Card>
      {adding && <AddMembersDialog orgId={orgId} orgName={detail.org.name} onClose={() => setAdding(false)} onAdded={() => setVersion((v) => v + 1)} />}
    </div>
  );
}

function MemberRow(props: { member: DirectoryMember; detail: OrgAdminDetail; myRole: OrgRole; myId: string; owners: number; onChanged: () => void }) {
  const { member: m, detail, myRole, myId, owners, onChanged } = props;
  const orgId = detail.org.id;
  const engine = useEngine();
  const menu = useMenu();
  const act = useAction();
  const [editing, setEditing] = useState<"title" | "remove" | "expiry" | "timeout" | "ban" | "report" | null>(null);
  const guestExpiry = useOrbit((st) => st.server?.features.includes("guest-expiry") ?? false);
  const features = useOrbit((st) => st.server?.features ?? []);
  const p = detail.permissions;
  const self = m.id === myId;
  const role = (m.orgRole ?? "MEMBER") as OrgRole;
  const roles = assignableRoles(myRole, role, self, owners);
  const canTitle = titleChangeAllowed(myRole, role, self);
  const canRemove = !self && removalAllowed(myRole, role, owners);
  // A guest's end date (round 7): set by people who can change member access, i.e. who may change this guest's role.
  const canExpire = role === "GUEST" && roles.length > 0 && guestExpiry;
  // Timeouts and bans (MOD-05, MOD-06), mirroring the server's rule only to decide what to offer: never owners, admins
  // only by the owner. The server checks again.
  const lower = !self && role !== "OWNER" && (role !== "ADMIN" || myRole === "OWNER");
  const canTimeout = lower && (p.isOwner || p.effective.includes("members.timeout"));
  const canBan = lower && p.canBan && features.includes("community-moderation");
  const timedOut = running(m.timeoutUntil);
  const entries: MenuEntry[] = [
    ...(canExpire ? [{ label: m.expiresAt ? "Change end date…" : "Set an end date…", onSelect: () => setEditing("expiry") }] : []),
    ...(roles.length ? [{ heading: "Role" } as const] : []),
    ...roles.map((r) => ({
      label: `Make ${roleName(r).toLowerCase()}`,
      onSelect: () => void act.act(() => changeMember(engine, orgId, m.id, { role: r }).then(onChanged)),
    })),
    ...(canTitle ? [{ label: "Edit title…", onSelect: () => setEditing("title") }] : []),
    // Android B1: from least to most severe, so Report comes before timeout, removing and banning.
    ...(!self && features.includes("reports") ? [{ label: "Report…", onSelect: () => setEditing("report") }] : []),
    ...(canTimeout
      ? [
          "separator" as const,
          timedOut
            ? { label: "End timeout", onSelect: () => void act.act(() => setTimeout_(engine, orgId, m.id, null, null).then(onChanged)) }
            : { label: "Time out…", onSelect: () => setEditing("timeout") },
        ]
      : []),
    ...(canRemove
      ? ["separator" as const, { label: features.includes("community-channels") ? "Remove from community…" : "Remove from community…", danger: true, onSelect: () => setEditing("remove") }]
      : []),
    ...(canBan ? [{ label: "Ban…", danger: true, onSelect: () => setEditing("ban") }] : []),
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
          {role === "GUEST" && m.expiresAt ? ` · guest until ${new Date(m.expiresAt).toLocaleDateString()}` : ""}
        </small>
      </span>
      {timedOut && (
        <span className="tag warn" title={`Until ${untilWhen(m.timeoutUntil!)}`}>
          Timed out
        </span>
      )}
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
      {editing === "expiry" && <ExpiryDialog member={m} orgId={orgId} onClose={() => setEditing(null)} onSaved={onChanged} />}
      {editing === "timeout" && <TimeoutDialog member={m} orgId={orgId} onClose={() => setEditing(null)} onSaved={onChanged} />}
      {editing === "ban" && <BanDialog member={m} orgId={orgId} onClose={() => setEditing(null)} onSaved={onChanged} />}
      {editing === "report" && (
        <ReportDialog target={{ kind: "person", userId: m.id, name: m.displayName, communities: [{ id: orgId, name: detail.org.name }], orgId }} onClose={() => setEditing(null)} />
      )}
      {editing === "remove" && (
        <Dialog title={`Remove ${m.displayName}?`} onClose={() => setEditing(null)}>
          <div className="dialog-body">
            <p style={{ margin: 0 }}>They'll lose access to this community's channels and voice rooms. Direct messages with them stay.</p>
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

/** A guest's end date (round 7, docs/WORKSPACE_C5.md › Guests): the server keeps it within the workspace's maximum. */
function ExpiryDialog({ member, orgId, onClose, onSaved }: { member: DirectoryMember; orgId: string; onClose: () => void; onSaved: () => void }) {
  const engine = useEngine();
  const act = useAction();
  const [date, setDate] = useState(member.expiresAt ? new Date(member.expiresAt).toISOString().slice(0, 10) : "");
  const save = (expiresAt: number | null) =>
    void act.act(async () => {
      await setGuestExpiry(engine, orgId, member.id, expiresAt);
      onSaved();
      onClose();
    });
  return (
    <Dialog title={`${member.displayName}'s end date`} onClose={onClose}>
      <div className="dialog-body">
        <p className="faint" style={{ margin: 0 }}>
          On this day they leave the community, exactly as if removed: channels, teams, groups and meeting invitations.
        </p>
        <label className="field">
          <span>Last day</span>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <ErrorLine text={act.error} />
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          {member.expiresAt && (
            <button className="btn btn-secondary" disabled={act.busy} onClick={() => save(null)}>
              No end date
            </button>
          )}
          <button className="btn btn-primary" disabled={act.busy || !date} onClick={() => save(new Date(`${date}T23:59:59`).getTime())}>
            Save
          </button>
        </div>
      </div>
    </Dialog>
  );
}

/** Time out (MOD-06, android TimeoutSheet): 60 seconds to a week; they can read but not post, share files or talk. */
function TimeoutDialog({ member, orgId, onClose, onSaved }: { member: DirectoryMember; orgId: string; onClose: () => void; onSaved: () => void }) {
  const engine = useEngine();
  const act = useAction();
  const [reason, setReason] = useState("");
  return (
    <Dialog title={`Time out ${member.displayName}`} onClose={onClose}>
      <div className="dialog-body">
        <p className="muted" style={{ margin: 0 }}>
          They can read but not post, share files or talk in voice channels, anywhere in the community, and they're taken out of its calls.
        </p>
        <input
          className="input"
          aria-label="Reason (optional, in the audit log)"
          placeholder="Reason (optional, in the audit log)"
          maxLength={300}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <ErrorLine text={act.error} />
        <div style={{ display: "grid", gap: 2 }}>
          {TIMEOUT_CHOICES.map((c) => (
            <button
              key={c.ms}
              className="list-row"
              disabled={act.busy}
              onClick={() =>
                void act.act(async () => {
                  await setTimeout_(engine, orgId, member.id, Date.now() + c.ms, reason || null);
                  onSaved();
                  onClose();
                })
              }
            >
              <span className="lines">
                <span>{c.label}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </Dialog>
  );
}

/** Ban (MOD-05): removes them now and keeps them out (invitations and open joining) until the ban is lifted. */
function BanDialog({ member, orgId, onClose, onSaved }: { member: DirectoryMember; orgId: string; onClose: () => void; onSaved: () => void }) {
  const engine = useEngine();
  const act = useAction();
  const [reason, setReason] = useState("");
  return (
    <Dialog title={`Ban ${member.displayName}?`} onClose={onClose}>
      <div className="dialog-body">
        <p style={{ margin: 0 }}>They're removed from the community and can't come back until you lift the ban (Community settings › Bans).</p>
        <input className="input" aria-label="Reason (optional)" placeholder="Reason (optional)" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        <ErrorLine text={act.error} />
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-danger"
            disabled={act.busy}
            onClick={() =>
              void act.act(async () => {
                await ban(engine, orgId, member.id, reason || null);
                onSaved();
                onClose();
              })
            }
          >
            Ban
          </button>
        </div>
      </div>
    </Dialog>
  );
}
