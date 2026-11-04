import { countLabel } from "../../i18n/counts";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Ticket } from "lucide-react";
import { type FormEvent, useState } from "react";
import type { Invite, NewInvite, OrgAdminDetail, OrgRole } from "../../api/workspaceSchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { createInvitation, invitations, revokeInvitation } from "../../sync/workspaces";
import { invitableRoles, roleName } from "../../sync/workspaceRules";
import { shortWhen, untilWhen } from "../format";
import { useAction, useLoad } from "./useLoad";
import { Card, ErrorLine } from "../components/SettingsCard";
import { QrCode } from "../components/QrCode";
import { inviteLink } from "../../sync/inviteCodes";
import { EXPIRY, InviteShare, USES } from "./InviteLink";
import { rolesOverview } from "../../sync/roles";
const STATUS: Record<Invite["status"], string> = {
  get active() {
    return uiText("workspace.interface.active_9234069");
  },
  get revoked() {
    return uiText("workspace.interface.revoked_f6f738d");
  },
  get expired() {
    return uiText("workspace.interface.expired_424a255");
  },
  get used_up() {
    return uiText("workspace.interface.used_up_cc2a6d1");
  },
};
/**
 * Invitations (docs/WORKSPACE_ADMINISTRATION.md §4): a code that admits people with a role, optionally into a branch or
 * team. No email is sent; whoever makes the code shares it. Admins see every invitation, others their own.
 */
export function InvitationsPage({ detail }: { detail: OrgAdminDetail }) {
  useLocaleRender();
  const l10n = useLocalization();
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
        <Card title={uiText("calls.interface.invite_people_27bf0f2")} sub={uiText("workspace.interface.only_owners_admins_and_branch_or_team_managers_can_invite_people_5fe31ec")} />
      )}
      <Card title={isAdmin ? uiText("workspace.interface.all_invitations_ef51660") : uiText("workspace.interface.your_invitations_54a86d3")}>
        <ErrorLine text={list.error ?? revoke.error} />
        <ul className="ws-list" aria-label={l10n("organization.invitations")} aria-busy={list.loading}>
          {(list.data ?? []).map((inv) => (
            <li key={inv.id} className="ws-row">
              <Ticket size={18} className="faint" />
              <span className="lines grow">
                <span className="ellipsis">
                  …{inv.hint} · {roleName(inv.role)}
                  {scopeLabel(detail, inv)}
                </span>
                <small className="ellipsis">
                  <Localized
                    k="workspace.interface.used_made_by_7b9a054"
                    slots={[
                      inv.uses,
                      inv.maxUses,
                      inv.createdByName ?? uiText("workspace.interface.someone_2a59d59"),
                      shortWhen(inv.createdAt),
                      inv.status === "active" ? uiText("workspace.interface.expires_value0_e88bac6", { value0: untilWhen(inv.expiresAt) }) : "",
                    ]}
                  />
                </small>
              </span>
              <span className={`status-badge status-${inv.status}`}>{STATUS[inv.status]}</span>
              {inv.status === "active" && (isAdmin || inv.createdBy === engine.device.userId) ? (
                <button className="btn btn-ghost btn-sm" disabled={revoke.busy} onClick={() => void revoke.act(() => revokeInvitation(engine, inv.id).then(() => setVersion((v) => v + 1)))}>
                  <Localized k="settings.interface.revoke_87e6d00" />
                </button>
              ) : (
                <span style={{ width: 64 }} />
              )}
            </li>
          ))}
          {list.data?.length === 0 && (
            <li className="faint">
              <Localized k="workspace.interface.no_invitations_yet_e13f92a" />
            </li>
          )}
        </ul>
      </Card>
    </div>
  );
}
function scopeLabel(
  d: OrgAdminDetail,
  inv: {
    branchId: string | null;
    teamId: string | null;
  },
): string {
  const team = inv.teamId ? d.teams.find((t) => t.id === inv.teamId) : null;
  const branch = inv.branchId ? d.branches.find((b) => b.id === inv.branchId) : null;
  if (team) return uiText("workspace.interface.team_value0_96c9771", { value0: team.name });
  if (branch) return ` · ${branch.name}`;
  return "";
}
function NewInvitation({ detail, onCreated }: { detail: OrgAdminDetail; onCreated: () => void }) {
  useLocaleRender();
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
    ...(isAdmin || community ? [{ value: "", label: community ? uiText("organization.interface.the_whole_community_838f2d7") : uiText("organization.interface.the_whole_community_838f2d7") }] : []),
    ...detail.branches.filter((b) => isAdmin || b.canManage).map((b) => ({ value: `b:${b.id}`, label: uiText("organization.interface.branch_value0_de7df4c", { value0: b.name }) })),
    ...detail.teams.filter((t) => isAdmin || t.canManage).map((t) => ({ value: `t:${t.id}`, label: uiText("organization.interface.team_value0_0c69424", { value0: t.name }) })),
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
    <Card title={uiText("calls.interface.invite_people_27bf0f2")} sub={uiText("workspace.interface.share_the_code_yourself_in_person_or_over_a_channel_you_trust_any_d841d0f")}>
      <form onSubmit={submit} className="ws-form">
        <label className="field">
          <span>
            <Localized k="messaging.interface.role_14736a2" />
          </span>
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
            <span>
              <Localized k="workspace.interface.into_ae8252d" />
            </span>
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
            <span>
              <Localized k="workspace.interface.also_give_the_role_34a64fb" />
            </span>
            <select className="input" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              <option value="">
                <Localized k="workspace.interface.no_extra_role_a30c68c" />
              </option>
              {grantable.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          <span>
            <Localized k="workspace.interface.uses_9e6151a" />
          </span>
          <select className="input" value={uses} onChange={(e) => setUses(Number(e.target.value))}>
            {USES.map((n) => (
              <option key={n} value={n}>
                {countLabel(n, "uses")}
              </option>
            ))}
          </select>
        </label>
        {role === "GUEST" && guestExpiry && (
          <label className="field">
            <span>
              <Localized k="workspace.interface.guest_for_days_da5f55b" />
            </span>
            <input
              className="input"
              type="number"
              min={1}
              max={org?.guestMaxDays ?? 365}
              value={guestDays}
              onChange={(e) => setGuestDays(e.target.value)}
              placeholder={org?.guestMaxDays ? uiText("workspace.interface.at_most_value0_69e037d", { value0: org.guestMaxDays }) : uiText("workspace.interface.no_end_date_4cde242")}
            />
          </label>
        )}
        {role === "GUEST" && guestsOff && (
          <p className="warn-text ws-wide" style={{ margin: 0, fontSize: 13 }}>
            <Localized k="workspace.interface.guests_are_turned_off_for_this_community_so_the_server_will_refus_b3ee02c" />
          </p>
        )}
        <label className="field">
          <span>
            <Localized k="workspace.interface.expires_after_a5e4b9f" />
          </span>
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
            <Ticket size={14} /> {act.busy ? uiText("workspace.interface.making_398c838") : uiText("workspace.interface.make_invitation_b471f32")}
          </button>
        </div>
      </form>
      <ErrorLine text={act.error} />
      {made && (
        <div className="code-box" role="status">
          <QrCode text={inviteLink(made.code)} size={132} label={uiText("workspace.interface.qr_code_for_invitation_value0_f9387b5", { value0: made.code })} />
          <span className="grow">
            <span className="code" style={{ fontSize: 22 }}>
              {made.code}
            </span>
            <small className="faint" style={{ display: "block" }}>
              <Localized k="workspace.interface.native_count_b6acb37b3" slots={[roleName(made.role), countLabel(made.maxUses, "uses"), "", untilWhen(made.expiresAt)]} />
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
