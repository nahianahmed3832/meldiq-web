import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { useState } from "react";
import { groupPermissions, searchPermissions } from "../../sync/permissionGroups";
import type { PermissionDef } from "../../sync/roles";
interface PermissionChecklistProps {
  catalog: readonly PermissionDef[];
  grants: ReadonlySet<string>;
  denies?: ReadonlySet<string>;
  /** Whether this person may change [p] (the server checks again). */
  canChange: (p: PermissionDef) => boolean;
  onGrant: (key: string, on: boolean) => void;
  /** Roles only: restricting a key (restrictions win over grants). */
  onDeny?: (key: string, on: boolean) => void;
  /** Whether this person may restrict [p]; defaults to [canChange]. */
  canDeny?: (p: PermissionDef) => boolean;
  onClear?: () => void;
}
/**
 * The reference's permission list: a search box, then General, Membership, Text, Voice and Advanced, each row with the
 * server's label and one-line hint. Used for a role's Permissions tab and for the @everyone defaults.
 */
export function PermissionChecklist({ catalog, grants, denies, canChange, onGrant, onDeny, canDeny, onClear }: PermissionChecklistProps) {
  useLocaleRender();
  const l10n = useLocalization();
  const [q, setQ] = useState("");
  const groups = groupPermissions(searchPermissions(catalog, q));
  return (
    <>
      <div className="row" style={{ gap: 8, alignItems: "center" }}>
        <input
          className="input perm-search grow"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={uiText("organization.interface.search_permissions_0e09911")}
          aria-label={uiText("organization.interface.search_permissions_0e09911")}
        />
        {onClear && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClear}>
            <Localized k="organization.interface.clear_permissions_f55a316" />
          </button>
        )}
      </div>
      {groups.length === 0 && (
        <p className="faint">
          <Localized k="organization.interface.no_permission_matches_060d922" slots={[q]} />
        </p>
      )}
      {groups.map((g) => (
        <fieldset key={g.key} className="perm-group">
          <legend className="perm-group-title">{g.label}</legend>
          {g.items.map((p) => {
            const can = canChange(p);
            return (
              <div key={p.key} className="perm-row">
                <div className="lines grow">
                  <span>
                    {p.label}
                    {p.admin && (
                      <span className="tag" style={{ marginInlineStart: 6 }}>
                        {l10n("messaging.people_admin")}
                      </span>
                    )}
                  </span>
                  <small>{p.description}</small>
                </div>
                <label className="perm-choice">
                  <input type="checkbox" checked={grants.has(p.key)} disabled={!can} onChange={(e) => onGrant(p.key, e.target.checked)} />
                  <Localized k="organization.interface.grant_78b7d03" />
                </label>
                {onDeny && denies && p.restrictable && (
                  <label className="perm-choice">
                    <input type="checkbox" checked={denies.has(p.key)} disabled={!(canDeny ?? canChange)(p)} onChange={(e) => onDeny(p.key, e.target.checked)} />
                    <Localized k="organization.interface.restrict_26f2f6e" />
                  </label>
                )}
              </div>
            );
          })}
        </fieldset>
      ))}
    </>
  );
}
