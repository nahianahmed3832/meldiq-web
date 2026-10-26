import { Check, Copy, Link2, Share2, Ticket } from "lucide-react";
import { type FormEvent, useState } from "react";
import type { Invite, NewInvite, OrgAdminDetail, OrgRole } from "../../api/workspaceSchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { createInvitation, invitations, revokeInvitation } from "../../sync/workspaces";
import { invitableRoles, roleName } from "../../sync/workspaceRules";
import { shortWhen, untilWhen } from "../format";
import { useAction, useLoad } from "./useLoad";
import { Card, ErrorLine } from "./WorkspaceView";
import { QrCode } from "../components/QrCode";
import { inviteLink } from "../../sync/inviteCodes";
import { rolesOverview } from "../../sync/roles";

/** Batch B4 (android InviteChoices): 1 hour to 30 days, and 1 to 500 uses. */
const EXPIRY: { hours: number; label: string }[] = [
  { hours: 1, label: "1 hour" },
  { hours: 24, label: "1 day" },
  { hours: 72, label: "3 days" },
  { hours: 24 * 7, label: "7 days" },
  { hours: 24 * 30, label: "30 days" },
];

const USES = [1, 10, 50, 100, 500];

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
  // Community servers (API 0.12+) have no branches or teams: an invitation admits to the whole community, optionally
  // with one of its roles. Older servers: admins invite into the whole workspace, managers into what they manage.
  const community = useOrbit((st) => st.server?.features.includes("community-channels") ?? false);
  const customRoles = useLoad(() => (community && detail.permissions.canAssignRoles ? rolesOverview(engine, detail.org.id) : Promise.resolve(null)), [engine, detail.org.id, community]);
  const grantable = (customRoles.data?.roles ?? []).filter((r) => !r.archived && r.canAssign);
  const [roleId, setRoleId] = useState("");
  const scopes = [
    ...(isAdmin || community ? [{ value: "", label: community ? "The whole community" : "The whole workspace" }] : []),
    ...detail.branches.filter((b) => isAdmin || b.canManage).map((b) => ({ value: `b:${b.id}`, label: `Branch: ${b.name}` })),
    ...detail.teams.filter((t) => isAdmin || t.canManage).map((t) => ({ value: `t:${t.id}`, label: `Team: ${t.name}` })),
  ];
  const [role, setRole] = useState<OrgRole>("MEMBER");
  const [scope, setScope] = useState(scopes[0]?.value ?? "");
  const [uses, setUses] = useState(1);
  const [hours, setHours] = useState(72);
  const [guestDays, setGuestDays] = useState("");
  const guestExpiry = useOrbit((st) => st.server?.features.includes("guest-expiry") ?? false);
  const org = useOrbit((st) => st.orgs.find((o) => o.id === detail.org.id) ?? null);
  const guestsOff = guestExpiry && org?.guestsAllowed === false;
  const [made, setMade] = useState<NewInvite | null>(null);
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
        ...(community && roleId && role !== "GUEST" ? { roleId } : {}),
        ...(role === "GUEST" && guestExpiry && Number(guestDays) > 0 ? { guestDays: Number(guestDays) } : {}),
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
        {!community && (
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
        )}
        {community && grantable.length > 0 && role !== "GUEST" && (
          <label className="field">
            <span>Also give the role</span>
            <select className="input" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              <option value="">No extra role</option>
              {grantable.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          <span>Uses</span>
          <select className="input" value={uses} onChange={(e) => setUses(Number(e.target.value))}>
            {USES.map((n) => (
              <option key={n} value={n}>
                {n === 1 ? "1 use" : `${n} uses`}
              </option>
            ))}
          </select>
        </label>
        {role === "GUEST" && guestExpiry && (
          <label className="field">
            <span>Guest for (days)</span>
            <input
              className="input"
              type="number"
              min={1}
              max={org?.guestMaxDays ?? 365}
              value={guestDays}
              onChange={(e) => setGuestDays(e.target.value)}
              placeholder={org?.guestMaxDays ? `at most ${org.guestMaxDays}` : "no end date"}
            />
          </label>
        )}
        {role === "GUEST" && guestsOff && (
          <p className="warn-text ws-wide" style={{ margin: 0, fontSize: 13 }}>
            Guests are turned off for this workspace, so the server will refuse a guest invitation.
          </p>
        )}
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
          <QrCode text={inviteLink(made.code)} size={132} label={`QR code for invitation ${made.code}`} />
          <span className="grow">
            <span className="code" style={{ fontSize: 22 }}>
              {made.code}
            </span>
            <small className="faint" style={{ display: "block" }}>
              {roleName(made.role)} · {made.maxUses} {made.maxUses === 1 ? "use" : "uses"} · expires {untilWhen(made.expiresAt)}. Shown once. Scan the code with Meldiq on a phone, or share the code.
            </small>
          </span>
          <InviteShare code={made.code} />
        </div>
      )}
    </Card>
  );
}

/**
 * Copy the link, copy the code, or the device's own share sheet where there is one (community-first brief §F). Feedback
 * stays on the button for a moment; where the clipboard is unavailable (some mobile browsers), the link is shown to select.
 */
function InviteShare({ code }: { code: string }) {
  const link = inviteLink(code);
  const [done, setDone] = useState<"link" | "code" | null>(null);
  const [manual, setManual] = useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const copy = (what: "link" | "code") => {
    const write = navigator.clipboard?.writeText(what === "link" ? link : code);
    if (!write) return setManual(true);
    void write.then(
      () => {
        setDone(what);
        setTimeout(() => setDone(null), 1500);
      },
      () => setManual(true),
    );
  };
  return (
    <div className="invite-share" role="group" aria-label="Share this invitation">
      <button className="btn btn-primary btn-sm" onClick={() => copy("link")} aria-live="polite">
        {done === "link" ? <Check size={14} /> : <Link2 size={14} />} {done === "link" ? "Link copied" : "Copy link"}
      </button>
      <button className="btn btn-secondary btn-sm" onClick={() => copy("code")} aria-live="polite">
        {done === "code" ? <Check size={14} /> : <Copy size={14} />} {done === "code" ? "Copied" : "Copy code"}
      </button>
      {canShare && (
        <button className="btn btn-secondary btn-sm" onClick={() => void navigator.share({ title: "Join me on Meldiq", url: link }).catch(() => undefined)}>
          <Share2 size={14} /> Share…
        </button>
      )}
      {manual && <input className="input mono" readOnly value={link} aria-label="Invitation link" onFocus={(e) => e.currentTarget.select()} />}
    </div>
  );
}
