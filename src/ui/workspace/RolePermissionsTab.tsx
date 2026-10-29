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
  const [q, setQ] = useState("");
  const groups = groupPermissions(searchPermissions(catalog, q));
  return (
    <>
      <div className="row" style={{ gap: 8, alignItems: "center" }}>
        <input className="input perm-search grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search permissions" aria-label="Search permissions" />
        {onClear && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClear}>
            Clear permissions
          </button>
        )}
      </div>
      {groups.length === 0 && <p className="faint">No permission matches “{q}”.</p>}
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
                      <span className="tag" style={{ marginLeft: 6 }}>
                        Admin
                      </span>
                    )}
                  </span>
                  <small>{p.description}</small>
                </div>
                <label className="perm-choice">
                  <input type="checkbox" checked={grants.has(p.key)} disabled={!can} onChange={(e) => onGrant(p.key, e.target.checked)} />
                  Grant
                </label>
                {onDeny && denies && p.restrictable && (
                  <label className="perm-choice">
                    <input type="checkbox" checked={denies.has(p.key)} disabled={!(canDeny ?? canChange)(p)} onChange={(e) => onDeny(p.key, e.target.checked)} />
                    Restrict
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
