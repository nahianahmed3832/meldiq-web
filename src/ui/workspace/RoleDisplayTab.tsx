import { Toggle } from "../components/Toggle";
import { namePaint } from "../people/NameStyle";
import type { AutoAssign } from "../../sync/roles";
import { autoRoleProblem } from "../../sync/permissionGroups";

/** A role being made or changed: what each tab edits. */
export interface RoleDraft {
  name: string;
  description: string;
  color: string | null;
  color2: string | null;
  hoist: boolean;
  mentionable: boolean;
  autoMode: AutoAssign["mode"];
  /** "joined before" this day (yyyy-mm-dd), or "". */
  autoBefore: string;
  grants: ReadonlySet<string>;
  denies: ReadonlySet<string>;
}

export const ROLE_COLORS = ["#C58BE0", "#E39B7B", "#E3C26F", "#6FBF8E", "#6FC6C9", "#7C9CE3", "#E37B9B", "#8C8FA3"];

interface DisplayTabProps {
  draft: RoleDraft;
  patch: (change: Partial<RoleDraft>) => void;
  readOnly: boolean;
  nameMax: number;
  descriptionMax: number;
  /** Community parity A1 extras: gradient, mentions, automatic assignment (servers with community-permissions). */
  extras: boolean;
  hoistable: boolean;
}

function ColorRow({ label, value, onChange, disabled, allowNone }: { label: string; value: string | null; onChange: (c: string | null) => void; disabled: boolean; allowNone: string }) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="row" style={{ gap: 4, flexWrap: "wrap", alignItems: "center" }} role="radiogroup" aria-label={label}>
        {ROLE_COLORS.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={value === c} aria-label={c} disabled={disabled} className="role-swatch" style={{ background: c }} onClick={() => onChange(c)} />
        ))}
        <input type="color" value={value ?? "#8c8fa3"} disabled={disabled} aria-label={`${label}: any colour`} onChange={(e) => onChange(e.target.value.toUpperCase())} />
        <span className="mono faint">{value ?? "—"}</span>
        {value && (
          <button type="button" className="btn btn-ghost btn-sm" disabled={disabled} onClick={() => onChange(null)}>
            {allowNone}
          </button>
        )}
      </div>
    </div>
  );
}

/** Display: name, colour (and the colour it fades into), description, member list, mentions and automatic assignment. */
export function RoleDisplayTab({ draft, patch, readOnly, nameMax, descriptionMax, extras, hoistable }: DisplayTabProps) {
  const colors = draft.color ? (draft.color2 && extras ? [draft.color, draft.color2] : [draft.color]) : null;
  const problem = extras ? autoRoleProblem(draft.autoMode, draft.grants.size, draft.denies.size) : null;
  return (
    <>
      <label className="field">
        <span>Role name</span>
        <input className="input" value={draft.name} maxLength={nameMax} disabled={readOnly} onChange={(e) => patch({ name: e.target.value })} data-autofocus />
      </label>
      <ColorRow label="Colour" value={draft.color} disabled={readOnly} allowNone="Remove colour" onChange={(color) => patch({ color, ...(color ? {} : { color2: null }) })} />
      {extras && draft.color && <ColorRow label="Fade into a second colour (optional)" value={draft.color2} disabled={readOnly} allowNone="One colour" onChange={(color2) => patch({ color2 })} />}
      <p className={`role-name-preview${colors && colors.length > 1 ? " grad" : ""}`} style={namePaint(colors)} aria-label="Preview">
        {draft.name.trim() || "New role"}
      </p>
      <label className="field">
        <span>Description</span>
        <input
          className="input"
          value={draft.description}
          maxLength={descriptionMax}
          disabled={readOnly}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="What this role is for"
        />
      </label>
      {hoistable && (
        <div className="setting">
          <span className="lines">
            <strong>Show members separately</strong>
            <small>Lists people under this role's name. An active owner's group always appears first; otherwise, roles follow their order.</small>
          </span>
          <Toggle checked={draft.hoist} disabled={readOnly} onChange={(hoist) => patch({ hoist })} label="Show members separately" />
        </div>
      )}
      {extras && (
        <>
          <div className="setting">
            <span className="lines">
              <strong>Let anyone @mention this role</strong>
              <small>People who may mention @everyone can always mention it.</small>
            </span>
            <Toggle checked={draft.mentionable} disabled={readOnly} onChange={(mentionable) => patch({ mentionable })} label="Let anyone mention this role" />
          </div>
          <fieldset className="field" disabled={readOnly}>
            <legend>Give this role automatically</legend>
            {(
              [
                ["none", "Nobody"],
                ["everyone", "Everyone in the community"],
                ["joined_before", "Everyone who joined before a date"],
              ] as const
            ).map(([mode, label]) => (
              <label key={mode} className="row" style={{ gap: 6 }}>
                <input type="radio" name="auto-assign" checked={draft.autoMode === mode} onChange={() => patch({ autoMode: mode })} /> {label}
              </label>
            ))}
            {draft.autoMode === "joined_before" && (
              <input className="input" type="date" aria-label="Joined before" value={draft.autoBefore} onChange={(e) => patch({ autoBefore: e.target.value })} style={{ maxWidth: 200 }} />
            )}
            <small className="faint">Roles given automatically are for looks: they can't carry permissions.</small>
          </fieldset>
          {problem && (
            <div className="banner warn" role="alert">
              {problem}
            </div>
          )}
        </>
      )}
    </>
  );
}
