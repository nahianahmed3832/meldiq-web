import { countLabel } from "../../i18n/counts";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Check, Minus, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { ApiError } from "../../api/client";
import type { Overwrite, Overwrites } from "../../api/communitySchemas";
import { PermissionPreview } from "./PermissionPreview";
import { useEngine, useOrbit } from "../../application/orbit";
import { type OverwriteTarget, overwrites, setOverwrite } from "../../sync/community";
import {
  accessRule,
  EVERYONE,
  isPrivate,
  orderedOverwrites,
  type OverwriteState,
  overwritesSynced,
  overwriteState,
  privacyRule,
  syncTargets,
  USER_PREFIX,
  whoCanView,
  withState,
} from "../../sync/communityRules";
import { directory } from "../../sync/workspaces";
import { groupPermissions, searchPermissions } from "../../sync/permissionGroups";
import { Toggle } from "../components/Toggle";
import { Dialog } from "../components/Overlay";
import { useLoad } from "../workspace/useLoad";
const STATES: {
  state: OverwriteState;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    state: "deny",
    get label() {
      return uiText("organization.interface.deny_05a2d73");
    },
    icon: <X size={14} />,
  },
  {
    state: "inherit",
    get label() {
      return uiText("organization.interface.inherit_3f72f03");
    },
    icon: <Minus size={14} />,
  },
  {
    state: "allow",
    get label() {
      return uiText("organization.interface.allow_e213c16");
    },
    icon: <Check size={14} />,
  },
];
/**
 * Permissions of a category or a channel (docs/COMMUNITY_REBUILD_2026-10-21.md §5): for @everyone, a role or a member,
 * each capability is denied, inherited or allowed. A category's rules apply to its channels first, the channel's own
 * on top. The server re-checks everyone's access after each change and refuses what the person may not grant.
 */
export function PermissionsDialog({ orgId, target, title, onClose }: { orgId: string; target: OverwriteTarget; title: string; onClose: () => void }) {
  useLocaleRender();
  return (
    <Dialog title={uiText("organization.interface.permissions_value0_b989527", { value0: title })} onClose={onClose} wide>
      <div className="dialog-body">
        <PermissionsBody orgId={orgId} target={target} />
      </div>
    </Dialog>
  );
}
/** The permissions themselves, also Edit channel's Permissions tab: Basic (who can see it) and Advanced (3-state rows). */
export function PermissionsBody({ orgId, target }: { orgId: string; target: OverwriteTarget }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const previewOn = useOrbit((s) => s.server?.features.includes("permission-preview") ?? false);
  const loaded = useLoad(() => overwrites(engine, target), [engine, target.type, target.id]);
  const [data, setData] = useState<Overwrites | null>(null);
  const [subject, setSubject] = useState<string>(EVERYONE);
  // Android A3: Basic (private or not, and who can see it) first; Advanced is every capability for every subject.
  const [mode, setMode] = useState<"basic" | "advanced" | "preview">("basic");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const d = data ?? loaded.data;
  const write = async (s: string, allow: string[], deny: string[]) => {
    setBusy(true);
    setError(null);
    try {
      const next = await setOverwrite(engine, orgId, target, s, allow, deny);
      setData(next);
      const removed = next.removed;
      if (removed) engine.notice("info", uiText("organization.interface.value0_lost_access_83cd5bb", { value0: countLabel(removed, "people") }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : uiText("organization.interface.couldn_t_change_the_permissions_49b379f"));
    } finally {
      setBusy(false);
    }
  };
  const synced = target.type === "channel" && d ? overwritesSynced(d.overwrites) : true;
  if (!d) return loaded.error ? <ErrorLine text={loaded.error} /> : <span className="skeleton" style={{ height: 180 }} />;
  return (
    <>
      <p className="muted" style={{ margin: 0 }}>
        {target.type === "category"
          ? uiText("organization.interface.its_channels_follow_these_rules_unless_they_have_their_own_owners_b1d2777")
          : synced
            ? uiText("organization.interface.this_channel_follows_its_category_s_permissions_allow_or_deny_thi_164c5fc")
            : uiText("organization.interface.this_channel_has_rules_of_its_own_on_top_of_its_category_s_neutra_4a20078")}
      </p>
      {target.type === "channel" && !synced && d.canManage && (
        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void syncTargets(d.overwrites).reduce((p, s) => p.then(() => write(s, [], [])), Promise.resolve())}>
          <Localized k="organization.interface.sync_with_category_f760314" slots={[<RefreshCw size={14} />]} />
        </button>
      )}
      <ErrorLine text={error} />
      <div className="segmented" role="group" aria-label={uiText("organization.interface.permissions_view_603b8db")}>
        <button aria-pressed={mode === "basic"} onClick={() => setMode("basic")}>
          <Localized k="organization.interface.basic_0e35f6e" />
        </button>
        <button aria-pressed={mode === "advanced"} onClick={() => setMode("advanced")}>
          {l10n("settings.settings_advanced")}
        </button>
        {previewOn && (
          <button aria-pressed={mode === "preview"} onClick={() => setMode("preview")}>
            <Localized k="organization.interface.view_as_5787b5e" />
          </button>
        )}
      </div>
      {mode === "preview" ? (
        <PermissionPreview orgId={orgId} target={target} roles={d.roles} revision={d} />
      ) : mode === "basic" ? (
        <BasicPermissions orgId={orgId} d={d} kind={target.type} busy={busy} write={write} />
      ) : (
        <AdvancedPermissions d={d} subject={subject} onSubject={setSubject} busy={busy} write={write} />
      )}
      {!d.canManage && (
        <p className="faint" style={{ margin: 0 }}>
          <Localized k="organization.interface.you_can_see_these_rules_but_not_change_them_9011015" />
        </p>
      )}
    </>
  );
}
function ErrorLine({ text }: { text: string | null }) {
  useLocaleRender();
  return text ? (
    <div className="banner danger" role="alert">
      {text}
    </div>
  ) : null;
}
/**
 * Advanced (the reference's Permissions tab): the roles with rules here (@everyone first) and "+ Add a role", then for
 * the chosen one every capability in its group (General, Text, Voice) as ✕ / neutral / ✓, with a search box.
 */
function AdvancedPermissions(props: { d: Overwrites; subject: string; onSubject: (s: string) => void; busy: boolean; write: (subject: string, allow: string[], deny: string[]) => Promise<void> }) {
  useLocaleRender();
  const l10n = useLocalization();
  const { d, subject, onSubject, busy, write } = props;
  const [q, setQ] = useState("");
  const [added, setAdded] = useState<string[]>([]);
  const listed: Overwrite[] = orderedOverwrites(d.overwrites);
  const current = listed.find((o) => o.subject === subject);
  const has = new Set([...listed.map((o) => o.subject), ...added]);
  const subjects = [
    {
      subject: EVERYONE,
      get label() {
        return uiText("organization.interface.everyone_a68e2ca");
      },
      color: null as string | null,
    },
    ...d.roles.filter((r) => has.has(r.id)).map((r) => ({ subject: r.id, label: r.name, color: r.color })),
    ...listed.filter((o) => o.kind === "member").map((o) => ({ subject: o.subject, label: o.label, color: null })),
  ];
  const addable = d.roles.filter((r) => !has.has(r.id));
  const label = subjects.find((s) => s.subject === subject)?.label ?? "@everyone";
  const caps = groupPermissions(searchPermissions(d.capabilities, q));
  return (
    <div className="perm-grid">
      <div className="perm-subjects" role="listbox" aria-label={uiText("organization.interface.roles_and_members_47e4613")}>
        <div className="perm-group-title">{l10n("organization.roles")}</div>
        {subjects.map((s) => {
          const o = listed.find((x) => x.subject === s.subject);
          const set = !!o && (o.allow.length > 0 || o.deny.length > 0);
          return (
            <button key={s.subject} role="option" aria-selected={subject === s.subject} className="side-item" onClick={() => onSubject(s.subject)} style={s.color ? { color: s.color } : undefined}>
              <span className="grow ellipsis">{s.label}</span>
              {set && <span className="dot" aria-label={uiText("organization.interface.has_rules_bb550c7")} />}
            </button>
          );
        })}
        {d.canManage && addable.length > 0 && (
          <select
            className="input input-sm"
            aria-label={uiText("organization.interface.add_a_role_c97781f")}
            value=""
            onChange={(e) => {
              if (!e.target.value) return;
              setAdded([...added, e.target.value]);
              onSubject(e.target.value);
            }}
          >
            <option value="">
              <Localized k="organization.interface.add_a_role_d297726" />
            </option>
            {addable.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="perm-caps">
        <strong>{label}</strong>
        <input
          className="input perm-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={uiText("organization.interface.search_permissions_0e09911")}
          aria-label={uiText("organization.interface.search_permissions_0e09911")}
        />
        {caps.length === 0 && (
          <p className="faint">
            <Localized k="organization.interface.no_permission_matches_060d922" slots={[q]} />
          </p>
        )}
        {caps.map((g) => (
          <section key={g.key} aria-label={g.label}>
            <h4 className="perm-group-title">{g.label}</h4>
            {g.items.map((cap) => (
              <CapabilityRow
                key={cap.key}
                cap={cap}
                state={overwriteState(current, cap.key)}
                disabled={busy || !d.canManage}
                onState={(st) => {
                  const next = withState(current, cap.key, st);
                  void write(subject, next.allow, next.deny);
                }}
              />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
function CapabilityRow({ cap, state, disabled, onState }: { cap: Overwrites["capabilities"][number]; state: OverwriteState; disabled: boolean; onState: (s: OverwriteState) => void }) {
  useLocaleRender();
  return (
    <div className="perm-row">
      <span className="lines">
        <strong>{cap.label}</strong>
        {cap.description && <small>{cap.description}</small>}
      </span>
      <div className="segmented perm-tri" role="radiogroup" aria-label={cap.label}>
        {STATES.map((x) => (
          <button
            key={x.state}
            role="radio"
            aria-checked={state === x.state}
            aria-pressed={state === x.state}
            aria-label={x.label}
            title={x.label}
            className={`perm-${x.state}`}
            disabled={disabled}
            onClick={() => onState(x.state)}
          >
            {x.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
/**
 * The Basic view (android A3): a Private switch (@everyone can't see it), "Who can access" with remove, and adding roles or
 * members. Only seeing the channel changes; every other rule stays as set in Advanced.
 */
function BasicPermissions(props: { orgId: string; d: Overwrites; kind: "category" | "channel"; busy: boolean; write: (subject: string, allow: string[], deny: string[]) => Promise<void> }) {
  useLocaleRender();
  const l10n = useLocalization();
  const { orgId, d, kind, busy, write } = props;
  const engine = useEngine();
  const [q, setQ] = useState("");
  const found = useLoad(() => (q.trim().length >= 2 ? directory(engine, orgId, q) : Promise.resolve([])), [engine, orgId, q]);
  const priv = isPrivate(d.overwrites);
  const access = whoCanView(d.overwrites);
  const has = new Set(access.map((o) => o.subject));
  const roles = d.roles.filter((r) => !has.has(r.id));
  const set = (rule: { subject: string; allow: string[]; deny: string[] }) => void write(rule.subject, rule.allow, rule.deny);
  const what = kind === "category" ? uiText("organization.interface.this_category_s_channels_b771a70") : uiText("organization.interface.this_channel_688733d");
  return (
    <div className="perm-basic">
      <div className="setting">
        <div className="lines">
          <strong>
            <Localized k="organization.interface.private_a044486" slots={[kind]} />
          </strong>
          <small>
            <Localized k="organization.interface.only_the_roles_and_members_below_can_see_owners_and_admins_always_5ca537d" slots={[what]} />
          </small>
        </div>
        <Toggle label={uiText("organization.interface.private_value0_462907d", { value0: kind })} checked={priv} disabled={busy || !d.canManage} onChange={(v) => set(privacyRule(d.overwrites, v))} />
      </div>
      {priv && access.length === 0 && (
        <div className="banner warn" role="status">
          <span className="grow">
            <Localized k="organization.interface.only_owners_and_admins_can_see_now_add_the_roles_or_members_who_s_5e440fd" slots={[what]} />
          </span>
        </div>
      )}
      <section aria-label={uiText("organization.interface.who_can_access_d2e50b4")}>
        <h3 className="ws-subhead">
          <Localized k="organization.interface.who_can_access_d2e50b4" />
        </h3>
        {access.length === 0 ? (
          <p className="faint" style={{ margin: 0 }}>
            {priv ? uiText("organization.interface.nobody_besides_owners_and_admins_7cd9b6c") : uiText("organization.interface.everyone_in_the_community_it_isn_t_private_6438889")}
          </p>
        ) : (
          <ul className="ws-list">
            {access.map((o) => (
              <li key={o.subject} className="list-row">
                <span className="grow" style={o.color ? { color: o.color } : undefined}>
                  {o.kind === "role" ? uiText("messaging.interface.value0_d91cbfb", { value0: o.label }) : o.label}
                </span>
                {d.canManage && (
                  <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => set(accessRule(d.overwrites, o.subject, false))}>
                    {l10n("common.actions.remove")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      {d.canManage && (
        <section aria-label={uiText("organization.interface.add_members_or_roles_21e2bd1")}>
          <h3 className="ws-subhead">
            <Localized k="organization.interface.add_members_or_roles_21e2bd1" />
          </h3>
          {roles.length > 0 && (
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              {roles.map((r) => (
                <button key={r.id} className="chip" disabled={busy} onClick={() => set(accessRule(d.overwrites, r.id, true))} style={r.color ? { color: r.color } : undefined}>
                  + @{r.name}
                </button>
              ))}
            </div>
          )}
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={uiText("organization.interface.add_a_member_by_name_or_username_8dc2007")}
            aria-label={uiText("organization.interface.find_a_member_to_add_8d92005")}
            style={{ marginTop: 8 }}
          />
          <ul className="ws-list">
            {(found.data ?? [])
              .filter((p) => !has.has(`${USER_PREFIX}${p.id}`))
              .slice(0, 6)
              .map((p) => (
                <li key={p.id}>
                  <button
                    className="list-row"
                    disabled={busy}
                    onClick={() => {
                      set(accessRule(d.overwrites, `${USER_PREFIX}${p.id}`, true));
                      setQ("");
                    }}
                  >
                    {p.displayName} <small className="faint">@{p.username}</small>
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
