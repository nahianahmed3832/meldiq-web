import { Check, Copy, Ticket } from "lucide-react";
import { type FormEvent, useState } from "react";
import type { Invite, NewInvite, OrgAdminDetail, OrgRole } from "../../api/workspaceSchemas";
import { useEngine } from "../../app/orbit";
import { createInvitation, invitations, revokeInvitation } from "../../sync/workspaces";
import { invitableRoles, roleName } from "../../sync/workspaceRules";
import { shortWhen, untilWhen } from "../format";
import { useAction, useLoad } from "./useLoad";
import { Card, ErrorLine } from "./WorkspaceView";

const EXPIRY: { hours: number; label: string }[] = [
  { hours: 24, label: "1 day" },
  { hours: 72, label: "3 days" },
  { hours: 24 * 7, label: "7 days" },
  { hours: 24 * 30, label: "30 days" },
];

const STATUS: Record<Invite["status"], string> = { active: "Active", revoked: "Revoked", expired: "Expired", used_up: "Used up" };

/**
 * Invitations (docs/WORKSPACE_ADMINISTRATION.md §4): a code that admits people with a role, optionally into a branch or
 * team. No email is sent; whoever makes the code shares it. Admins see every invitation, others their own.
 */
export function InvitationsPage({ detail }: { detail: OrgAdminDetail }) {
  const engine = useEngine();
  const orgId = detail.org.id;
  const [version, setVersion] = useState(0);
  const list = useLoad(() => invitations(engine, orgId), [engine, orgId, version]);
  const revoke = useAction();
  const isAdmin = detail.permissions.canManageOrg;

  return (
    <div className="ws-page">
      {detail.permissions.canInvite ? (
        <NewInvitation detail={detail} onCreated={() => setVersion((v) => v + 1)} />
      ) : (
        <Card title="Invite people" sub="Only owners, admins and branch or team managers can invite people." />
      )}
      <Card title={isAdmin ? "All invitations" : "Your invitations"}>
        <ErrorLine text={list.error ?? revoke.error} />
        <ul className="ws-list" aria-label="Invitations" aria-busy={list.loading}>
          {(list.data ?? []).map((inv) => (
            <li key={inv.id} className="ws-row">
              <Ticket size={18} className="faint" />
              <span className="lines grow">
                <span className="ellipsis">
                  …{inv.hint} · {roleName(inv.role)}
                  {scopeLabel(detail, inv)}
                </span>
                <small className="ellipsis">
                  {inv.uses}/{inv.maxUses} used · made by {inv.createdByName ?? "someone"} {shortWhen(inv.createdAt)} · {inv.status === "active" ? `expires ${untilWhen(inv.expiresAt)}` : ""}
                </small>
              </span>
              <span className={`status-badge status-${inv.status}`}>{STATUS[inv.status]}</span>
              {inv.status === "active" && (isAdmin || inv.createdBy === engine.device.userId) ? (
                <button className="btn btn-ghost btn-sm" disabled={revoke.busy} onClick={() => void revoke.act(() => revokeInvitation(engine, inv.id).then(() => setVersion((v) => v + 1)))}>
                  Revoke
                </button>
              ) : (
                <span style={{ width: 64 }} />
              )}
            </li>
          ))}
          {list.data?.length === 0 && <li className="faint">No invitations yet.</li>}
        </ul>
      </Card>
    </div>
  );
}

function scopeLabel(d: OrgAdminDetail, inv: { branchId: string | null; teamId: string | null }): string {
  const team = inv.teamId ? d.teams.find((t) => t.id === inv.teamId) : null;
  const branch = inv.branchId ? d.branches.find((b) => b.id === inv.branchId) : null;
  if (team) return ` · team ${team.name}`;
  if (branch) return ` · ${branch.name}`;
  return "";
}

function NewInvitation({ detail, onCreated }: { detail: OrgAdminDetail; onCreated: () => void }) {
  const engine = useEngine();
  const myRole = (detail.org.myRole ?? "MEMBER") as OrgRole;
  const isAdmin = detail.permissions.canManageOrg;
  const roles = isAdmin ? invitableRoles(myRole) : (["MEMBER", "GUEST"] as OrgRole[]);
  // Admins may invite into the whole workspace; managers only into what they manage.
  const scopes = [
    ...(isAdmin ? [{ value: "", label: "The whole workspace" }] : []),
    ...detail.branches.filter((b) => isAdmin || b.canManage).map((b) => ({ value: `b:${b.id}`, label: `Branch: ${b.name}` })),
    ...detail.teams.filter((t) => isAdmin || t.canManage).map((t) => ({ value: `t:${t.id}`, label: `Team: ${t.name}` })),
  ];
  const [role, setRole] = useState<OrgRole>("MEMBER");
  const [scope, setScope] = useState(scopes[0]?.value ?? "");
  const [uses, setUses] = useState(1);
  const [hours, setHours] = useState(72);
  const [made, setMade] = useState<NewInvite | null>(null);
  const [copied, setCopied] = useState(false);
  const act = useAction();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void act.act(async () => {
      const r = await createInvitation(engine, detail.org.id, {
        role: role as Exclude<OrgRole, "OWNER">,
        branchId: scope.startsWith("b:") ? scope.slice(2) : null,
        teamId: scope.startsWith("t:") ? scope.slice(2) : null,
        maxUses: uses,
        expiresInHours: hours,
      });
      setMade(r);
      onCreated();
    });
  };

  return (
    <Card title="Invite people" sub="Share the code yourself, in person or over a channel you trust. Anyone with it can join until it's used up, expires or is revoked.">
      <form onSubmit={submit} className="ws-form">
        <label className="field">
          <span>Role</span>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as OrgRole)}>
            {roles.map((r) => (
              <option key={r} value={r}>
                {roleName(r)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Into</span>
          <select className="input" value={scope} onChange={(e) => setScope(e.target.value)}>
            {scopes.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Uses</span>
          <input className="input" type="number" min={1} max={500} value={uses} onChange={(e) => setUses(Math.max(1, Math.min(500, Number(e.target.value) || 1)))} />
        </label>
        <label className="field">
          <span>Expires after</span>
          <select className="input" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
            {EXPIRY.map((x) => (
              <option key={x.hours} value={x.hours}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
        <div className="ws-form-actions">
          <button className="btn btn-primary btn-sm" disabled={act.busy || scopes.length === 0}>
            <Ticket size={14} /> {act.busy ? "Making…" : "Make invitation"}
          </button>
        </div>
      </form>
      <ErrorLine text={act.error} />
      {made && (
        <div className="code-box" role="status">
          <span className="grow">
            <span className="code" style={{ fontSize: 22 }}>
              {made.code}
            </span>
            <small className="faint" style={{ display: "block" }}>
              {roleName(made.role)} · {made.maxUses} {made.maxUses === 1 ? "use" : "uses"} · expires {untilWhen(made.expiresAt)}. Shown once.
            </small>
          </span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() =>
              void navigator.clipboard?.writeText(made.code).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              })
            }
          >
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
    </Card>
  );
}
