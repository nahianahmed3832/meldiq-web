import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
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
  useLocaleRender();
  return (
    <div className="field">
      <span>{label}</span>
      <div className="row" style={{ gap: 4, flexWrap: "wrap", alignItems: "center" }} role="radiogroup" aria-label={label}>
        {ROLE_COLORS.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={value === c} aria-label={c} disabled={disabled} className="role-swatch" style={{ background: c }} onClick={() => onChange(c)} />
        ))}
        <input
          type="color"
          value={value ?? "#8c8fa3"}
          disabled={disabled}
          aria-label={uiText("workspace.interface.value0_any_colour_ae0ec8c", { value0: label })}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
        />
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
  useLocaleRender();
  const l10n = useLocalization();
  const colors = draft.color ? (draft.color2 && extras ? [draft.color, draft.color2] : [draft.color]) : null;
  const problem = extras ? autoRoleProblem(draft.autoMode, draft.grants.size, draft.denies.size) : null;
  return (
    <>
      <label className="field">
        <span>
          <Localized k="workspace.interface.role_name_82c784c" />
        </span>
        <input className="input" value={draft.name} maxLength={nameMax} disabled={readOnly} onChange={(e) => patch({ name: e.target.value })} data-autofocus />
      </label>
      <ColorRow
        label={l10n("settings.ap_colour")}
        value={draft.color}
        disabled={readOnly}
        allowNone={uiText("organization.interface.remove_colour_6a1a1f8")}
        onChange={(color) => patch({ color, ...(color ? {} : { color2: null }) })}
      />
      {extras && draft.color && (
        <ColorRow
          label={uiText("workspace.interface.fade_into_a_second_colour_optional_40db92e")}
          value={draft.color2}
          disabled={readOnly}
          allowNone={uiText("organization.interface.one_colour_95230b1")}
          onChange={(color2) => patch({ color2 })}
        />
      )}
      <p className={`role-name-preview${colors && colors.length > 1 ? " grad" : ""}`} style={namePaint(colors)} aria-label={uiText("organization.interface.preview_324b134")}>
        {draft.name.trim() || uiText("workspace.interface.new_role_500f2f9")}
      </p>
      <label className="field">
        <span>
          <Localized k="workspace.interface.description_526e008" />
        </span>
        <input
          className="input"
          value={draft.description}
          maxLength={descriptionMax}
          disabled={readOnly}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder={uiText("workspace.interface.what_this_role_is_for_979f4dd")}
        />
      </label>
      {hoistable && (
        <div className="setting">
          <span className="lines">
            <strong>
              <Localized k="workspace.interface.show_members_separately_2e743e8" />
            </strong>
            <small>
              <Localized k="workspace.interface.lists_people_under_this_role_s_name_an_active_owner_s_group_alway_0d34c95" />
            </small>
          </span>
          <Toggle checked={draft.hoist} disabled={readOnly} onChange={(hoist) => patch({ hoist })} label={uiText("workspace.interface.show_members_separately_2e743e8")} />
        </div>
      )}
      {extras && (
        <>
          <div className="setting">
            <span className="lines">
              <strong>
                <Localized k="workspace.interface.let_anyone_mention_this_role_bfff5f2" />
              </strong>
              <small>
                <Localized k="workspace.interface.people_who_may_mention_everyone_can_always_mention_it_1424c64" />
              </small>
            </span>
            <Toggle checked={draft.mentionable} disabled={readOnly} onChange={(mentionable) => patch({ mentionable })} label={uiText("workspace.interface.let_anyone_mention_this_role_615c3b9")} />
          </div>
          <fieldset className="field" disabled={readOnly}>
            <legend>
              <Localized k="workspace.interface.give_this_role_automatically_6357fcb" />
            </legend>
            {(
              [
                ["none", uiText("workspace.interface.nobody_3fad99b")],
                ["everyone", uiText("workspace.interface.everyone_in_the_community_053d5f4")],
                ["joined_before", uiText("workspace.interface.everyone_who_joined_before_a_date_e53c873")],
              ] as const
            ).map(([mode, label]) => (
              <label key={mode} className="row" style={{ gap: 6 }}>
                <input type="radio" name="auto-assign" checked={draft.autoMode === mode} onChange={() => patch({ autoMode: mode })} /> {label}
              </label>
            ))}
            {draft.autoMode === "joined_before" && (
              <input
                className="input"
                type="date"
                aria-label={uiText("workspace.interface.joined_before_f55f373")}
                value={draft.autoBefore}
                onChange={(e) => patch({ autoBefore: e.target.value })}
                style={{ maxWidth: 200 }}
              />
            )}
            <small className="faint">
              <Localized k="workspace.interface.roles_given_automatically_are_for_looks_they_can_t_carry_permissi_ff04e25" />
            </small>
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
