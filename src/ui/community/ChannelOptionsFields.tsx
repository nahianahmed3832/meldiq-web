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
  if (roles.length === 0)
    return (
      <p className="faint" style={{ margin: 0 }}>
        No roles yet. Owners and community managers always can.
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
  if (voice) return row("stage", "Stage", "Listeners can't talk until a moderator brings them up; they raise a hand to ask. People who can mute members can always talk.");
  return (
    <>
      {full && row("textOnly", "Text only", "No pictures, files, GIFs or stickers, except from moderators.")}
      {full && row("noGifs", "No GIFs", "GIFs from the picker and GIF links are refused. Pictures are fine. Moderators are exempt.")}
      {row("readOnly", "Read-only", "Everyone reads and reacts; only the roles below and moderators can post.")}
      {v.readOnly && (
        <div className="field">
          <span>Who can post?</span>
          <RoleChips label="Who can post" roles={roles} picked={v.posterRoleIds} onChange={(posterRoleIds) => set({ posterRoleIds })} />
        </div>
      )}
      {slowmode && (
        <label className="field">
          <span>Slowmode</span>
          <select className="input" value={v.slowmodeSec} onChange={(e) => set({ slowmodeSec: Number(e.target.value) })}>
            {SLOWMODE_CHOICES.map((c) => (
              <option key={c.sec} value={c.sec}>
                {c.label}
              </option>
            ))}
          </select>
          <span className="hint">How long each member waits between messages. Moderators aren't slowed down.</span>
        </label>
      )}
    </>
  );
}
