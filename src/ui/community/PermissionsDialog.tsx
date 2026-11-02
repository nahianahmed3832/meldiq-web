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

const STATES: { state: OverwriteState; label: string; icon: React.ReactNode }[] = [
  { state: "deny", label: "Deny", icon: <X size={14} /> },
  { state: "inherit", label: "Inherit", icon: <Minus size={14} /> },
  { state: "allow", label: "Allow", icon: <Check size={14} /> },
];

/**
 * Permissions of a category or a channel (docs/COMMUNITY_REBUILD_2026-10-21.md §5): for @everyone, a role or a member,
 * each capability is denied, inherited or allowed. A category's rules apply to its channels first, the channel's own
 * on top. The server re-checks everyone's access after each change and refuses what the person may not grant.
 */
export function PermissionsDialog({ orgId, target, title, onClose }: { orgId: string; target: OverwriteTarget; title: string; onClose: () => void }) {
  return (
    <Dialog title={`Permissions · ${title}`} onClose={onClose} wide>
      <div className="dialog-body">
        <PermissionsBody orgId={orgId} target={target} />
      </div>
    </Dialog>
  );
}

/** The permissions themselves, also Edit channel's Permissions tab: Basic (who can see it) and Advanced (3-state rows). */
export function PermissionsBody({ orgId, target }: { orgId: string; target: OverwriteTarget }) {
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
      if (removed) engine.notice("info", `${removed === 1 ? "1 person" : `${removed} people`} lost access.`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't change the permissions.");
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
          ? "Its channels follow these rules unless they have their own. Owners and admins always have every permission."
          : synced
            ? "This channel follows its category's permissions. Allow or deny things just here; neutral uses the role's settings."
            : "This channel has rules of its own on top of its category's. Neutral uses the role's settings."}
      </p>
      {target.type === "channel" && !synced && d.canManage && (
        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void syncTargets(d.overwrites).reduce((p, s) => p.then(() => write(s, [], [])), Promise.resolve())}>
          <RefreshCw size={14} /> Sync with category
        </button>
      )}
      <ErrorLine text={error} />
      <div className="segmented" role="group" aria-label="Permissions view">
        <button aria-pressed={mode === "basic"} onClick={() => setMode("basic")}>
          Basic
        </button>
        <button aria-pressed={mode === "advanced"} onClick={() => setMode("advanced")}>
          Advanced
        </button>
        {previewOn && (
          <button aria-pressed={mode === "preview"} onClick={() => setMode("preview")}>
            View as
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
          You can see these rules but not change them.
        </p>
      )}
    </>
  );
}

function ErrorLine({ text }: { text: string | null }) {
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
  const { d, subject, onSubject, busy, write } = props;
  const [q, setQ] = useState("");
  const [added, setAdded] = useState<string[]>([]);
  const listed: Overwrite[] = orderedOverwrites(d.overwrites);
  const current = listed.find((o) => o.subject === subject);
  const has = new Set([...listed.map((o) => o.subject), ...added]);
  const subjects = [
    { subject: EVERYONE, label: "@everyone", color: null as string | null },
    ...d.roles.filter((r) => has.has(r.id)).map((r) => ({ subject: r.id, label: r.name, color: r.color })),
    ...listed.filter((o) => o.kind === "member").map((o) => ({ subject: o.subject, label: o.label, color: null })),
  ];
  const addable = d.roles.filter((r) => !has.has(r.id));
  const label = subjects.find((s) => s.subject === subject)?.label ?? "@everyone";
  const caps = groupPermissions(searchPermissions(d.capabilities, q));
  return (
    <div className="perm-grid">
      <div className="perm-subjects" role="listbox" aria-label="Roles and members">
        <div className="perm-group-title">Roles</div>
        {subjects.map((s) => {
          const o = listed.find((x) => x.subject === s.subject);
          const set = !!o && (o.allow.length > 0 || o.deny.length > 0);
          return (
            <button key={s.subject} role="option" aria-selected={subject === s.subject} className="side-item" onClick={() => onSubject(s.subject)} style={s.color ? { color: s.color } : undefined}>
              <span className="grow ellipsis">{s.label}</span>
              {set && <span className="dot" aria-label="has rules" />}
            </button>
          );
        })}
        {d.canManage && addable.length > 0 && (
          <select
            className="input input-sm"
            aria-label="Add a role"
            value=""
            onChange={(e) => {
              if (!e.target.value) return;
              setAdded([...added, e.target.value]);
              onSubject(e.target.value);
            }}
          >
            <option value="">+ Add a role</option>
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
        <input className="input perm-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search permissions" aria-label="Search permissions" />
        {caps.length === 0 && <p className="faint">No permission matches “{q}”.</p>}
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
  const { orgId, d, kind, busy, write } = props;
  const engine = useEngine();
  const [q, setQ] = useState("");
  const found = useLoad(() => (q.trim().length >= 2 ? directory(engine, orgId, q) : Promise.resolve([])), [engine, orgId, q]);
  const priv = isPrivate(d.overwrites);
  const access = whoCanView(d.overwrites);
  const has = new Set(access.map((o) => o.subject));
  const roles = d.roles.filter((r) => !has.has(r.id));
  const set = (rule: { subject: string; allow: string[]; deny: string[] }) => void write(rule.subject, rule.allow, rule.deny);
  const what = kind === "category" ? "this category's channels" : "this channel";
  return (
    <div className="perm-basic">
      <div className="setting">
        <div className="lines">
          <strong>Private {kind}</strong>
          <small>Only the roles and members below can see {what}. Owners and admins always can.</small>
        </div>
        <Toggle label={`Private ${kind}`} checked={priv} disabled={busy || !d.canManage} onChange={(v) => set(privacyRule(d.overwrites, v))} />
      </div>
      {priv && access.length === 0 && (
        <div className="banner warn" role="status">
          <span className="grow">Only owners and admins can see {what} now. Add the roles or members who should.</span>
        </div>
      )}
      <section aria-label="Who can access">
        <h3 className="ws-subhead">Who can access</h3>
        {access.length === 0 ? (
          <p className="faint" style={{ margin: 0 }}>
            {priv ? "Nobody besides owners and admins." : "Everyone in the community (it isn't private)."}
          </p>
        ) : (
          <ul className="ws-list">
            {access.map((o) => (
              <li key={o.subject} className="list-row">
                <span className="grow" style={o.color ? { color: o.color } : undefined}>
                  {o.kind === "role" ? `@${o.label}` : o.label}
                </span>
                {d.canManage && (
                  <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => set(accessRule(d.overwrites, o.subject, false))}>
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      {d.canManage && (
        <section aria-label="Add members or roles">
          <h3 className="ws-subhead">Add members or roles</h3>
          {roles.length > 0 && (
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              {roles.map((r) => (
                <button key={r.id} className="chip" disabled={busy} onClick={() => set(accessRule(d.overwrites, r.id, true))} style={r.color ? { color: r.color } : undefined}>
                  + @{r.name}
                </button>
              ))}
            </div>
          )}
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add a member by name or @username" aria-label="Find a member to add" style={{ marginTop: 8 }} />
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
