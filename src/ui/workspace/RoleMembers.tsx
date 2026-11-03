import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { UserMinus } from "lucide-react";
import { useState } from "react";
import { useEngine } from "../../application/orbit";
import { assignRole, type Role, roleMembers, unassignRole } from "../../sync/roles";
import { directory } from "../../sync/workspaces";
import { Avatar } from "../components/Avatar";
import { useAction, useLoad } from "./useLoad";
import { ErrorLine } from "./WorkspaceView";
interface RoleMembersListProps {
  orgId: string;
  role: Role;
  canAssign: boolean;
  onChanged: () => void;
}
/** A role's Manage Members: who holds it, removing them, and adding members found by name. */
export function RoleMembersList({ orgId, role, canAssign, onChanged }: RoleMembersListProps) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const [version, setVersion] = useState(0);
  const [q, setQ] = useState("");
  const members = useLoad(() => roleMembers(engine, role.id), [engine, role.id, version]);
  const people = useLoad(() => (canAssign ? directory(engine, orgId, q) : Promise.resolve([])), [engine, orgId, q, canAssign]);
  const act = useAction();
  const changed = () => {
    setVersion((v) => v + 1);
    onChanged();
  };
  const held = new Set((members.data ?? []).map((m) => m.id));
  return (
    <>
      <ErrorLine text={act.error ?? members.error} />
      {canAssign && (
        <>
          <input
            className="input"
            placeholder={uiText("workspace.interface.add_members_by_name_or_username_d507b62")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label={uiText("workspace.interface.search_members_6497fc6")}
          />
          <ul className="ws-list">
            {(people.data ?? [])
              .filter((p) => !held.has(p.id))
              .slice(0, 8)
              .map((p) => (
                <li key={p.id} className="ws-row">
                  <Avatar name={p.displayName} colorIndex={p.avatarColor} size={28} decorative />
                  <span className="lines grow">
                    <span>{p.displayName}</span>
                    <small>@{p.username}</small>
                  </span>
                  <button className="btn btn-secondary btn-sm" disabled={act.busy} onClick={() => void act.act(() => assignRole(engine, role.id, p.id).then(changed))}>
                    {l10n("common.actions.add")}
                  </button>
                </li>
              ))}
          </ul>
        </>
      )}
      <ul className="ws-list" aria-label={uiText("workspace.interface.people_with_value0_580891b", { value0: role.name })}>
        {(members.data ?? []).map((m) => (
          <li key={m.id} className="ws-row">
            <span className="lines grow">
              <span>{m.displayName}</span>
              <small>
                @{m.username} · {m.orgRole.toLowerCase()}
              </small>
            </span>
            {canAssign && (
              <button
                className="btn btn-ghost btn-sm"
                aria-label={uiText("messaging.interface.remove_value0_3028bf7", { value0: m.displayName })}
                disabled={act.busy}
                onClick={() => void act.act(() => unassignRole(engine, role.id, m.id).then(changed))}
              >
                <UserMinus size={14} />
              </button>
            )}
          </li>
        ))}
        {members.data?.length === 0 && (
          <li className="faint">
            <Localized k="workspace.interface.nobody_has_this_role_yet_ea94dc7" />
          </li>
        )}
      </ul>
    </>
  );
}
