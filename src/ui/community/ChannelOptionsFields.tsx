import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useEngine } from "../../application/orbit";
import { rolesOverview } from "../../sync/roles";
import { SLOWMODE_CHOICES } from "../../sync/communityRules";
import { Toggle } from "../components/Toggle";
import { useLoad } from "../workspace/useLoad";
/** A community role to pick in a channel dialog. */
export interface RoleChoice {
  id: string;
  name: string;
  color: string | null;
}
/** The community's active roles, for the access and poster chips (empty without roles.view). */
export function useRoleChoices(orgId: string, enabled: boolean): RoleChoice[] {
  const engine = useEngine();
  const roles = useLoad(
    () => (enabled ? rolesOverview(engine, orgId).then((o) => o.roles.filter((r) => !r.archived).map((r) => ({ id: r.id, name: r.name, color: r.color ?? null }))) : Promise.resolve([])),
    [engine, orgId, enabled],
  );
  return roles.data ?? [];
}
/** Role chips to pick several (Who can access, Who can post). */
export function RoleChips({ label, roles, picked, onChange }: { label: string; roles: readonly RoleChoice[]; picked: readonly string[]; onChange: (ids: string[]) => void }) {
  useLocaleRender();
  if (roles.length === 0)
    return (
      <p className="faint" style={{ margin: 0 }}>
        <Localized k="organization.interface.no_roles_yet_owners_and_community_managers_always_can_e81d5b5" />
      </p>
    );
  return (
    <div className="role-chips" role="group" aria-label={label}>
      {roles.map((r) => {
        const on = picked.includes(r.id);
        return (
          <button
            key={r.id}
            type="button"
            className="chip"
            aria-pressed={on}
            style={r.color ? { color: r.color } : undefined}
            onClick={() => onChange(on ? picked.filter((x) => x !== r.id) : [...picked, r.id])}
          >
            @{r.name}
          </button>
        );
      })}
    </div>
  );
}
/** A channel's options as the dialogs edit them (community parity A1). */
export interface ChannelOptionsDraft {
  textOnly: boolean;
  noGifs: boolean;
  readOnly: boolean;
  posterRoleIds: string[];
  stage: boolean;
  slowmodeSec: number;
}
export const NO_OPTIONS: ChannelOptionsDraft = { textOnly: false, noGifs: false, readOnly: false, posterRoleIds: [], stage: false, slowmodeSec: 0 };
interface OptionsFieldsProps {
  value: ChannelOptionsDraft;
  onChange: (v: ChannelOptionsDraft) => void;
  voice: boolean;
  roles: readonly RoleChoice[];
  /** Edit channel's Overview has Text only and No GIFs; Create channel only read-only and slowmode. */
  full: boolean;
  slowmode: boolean;
}
/** Text only, No GIFs, Read-only with who can post, Slowmode (text channels); Stage (voice channels). */
export function ChannelOptionsFields({ value: v, onChange, voice, roles, full, slowmode }: OptionsFieldsProps) {
  useLocaleRender();
  const set = (change: Partial<ChannelOptionsDraft>) => onChange({ ...v, ...change });
  const row = (key: "textOnly" | "noGifs" | "readOnly" | "stage", title: string, hint: string) => (
    <div className="setting">
      <span className="lines">
        <strong>{title}</strong>
        <small>{hint}</small>
      </span>
      <Toggle checked={v[key]} onChange={(on) => set({ [key]: on })} label={title} />
    </div>
  );
  if (voice) return row("stage", uiText("organization.interface.stage_de83885"), uiText("organization.interface.listeners_can_t_talk_until_a_moderator_brings_them_up_they_raise_8fd840c"));
  return (
    <>
      {full && row("textOnly", uiText("organization.interface.text_only_8bbfc64"), uiText("organization.interface.no_pictures_files_gifs_or_stickers_except_from_moderators_1f018d9"))}
      {full && row("noGifs", uiText("organization.interface.no_gifs_f52b485"), uiText("organization.interface.gifs_from_the_picker_and_gif_links_are_refused_pictures_are_fine_541a721"))}
      {row("readOnly", "Read-only", uiText("organization.interface.everyone_reads_and_reacts_only_the_roles_below_and_moderators_can_def1afc"))}
      {v.readOnly && (
        <div className="field">
          <span>
            <Localized k="organization.interface.who_can_post_1bffce3" />
          </span>
          <RoleChips label={uiText("organization.interface.who_can_post_cabffe4")} roles={roles} picked={v.posterRoleIds} onChange={(posterRoleIds) => set({ posterRoleIds })} />
        </div>
      )}
      {slowmode && (
        <label className="field">
          <span>
            <Localized k="organization.interface.slowmode_b529fb9" />
          </span>
          <select className="input" value={v.slowmodeSec} onChange={(e) => set({ slowmodeSec: Number(e.target.value) })}>
            {SLOWMODE_CHOICES.map((c) => (
              <option key={c.sec} value={c.sec}>
                {c.label}
              </option>
            ))}
          </select>
          <span className="hint">
            <Localized k="organization.interface.how_long_each_member_waits_between_messages_moderators_aren_t_slo_f03c608" />
          </span>
        </label>
      )}
    </>
  );
}
