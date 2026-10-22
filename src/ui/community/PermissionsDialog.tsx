import { Check, Minus, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { ApiError } from "../../api/client";
import type { Overwrite, Overwrites } from "../../api/communitySchemas";
import { useEngine } from "../../application/orbit";
import { type OverwriteTarget, overwrites, setOverwrite } from "../../sync/community";
import { EVERYONE, orderedOverwrites, type OverwriteState, overwritesSynced, overwriteState, syncTargets, withState } from "../../sync/communityRules";
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
  const engine = useEngine();
  const loaded = useLoad(() => overwrites(engine, target), [engine, target.type, target.id]);
  const [data, setData] = useState<Overwrites | null>(null);
  const [subject, setSubject] = useState<string>(EVERYONE);
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

  const listed: Overwrite[] = d ? orderedOverwrites(d.overwrites) : [];
  const current = listed.find((o) => o.subject === subject);
  const subjects = d
    ? [
        { subject: EVERYONE, label: "@everyone", kind: "everyone" },
        ...d.roles.map((r) => ({ subject: r.id, label: r.name, kind: "role" })),
        ...listed.filter((o) => o.kind === "member").map((o) => ({ subject: o.subject, label: o.label, kind: "member" })),
      ]
    : [];
  const synced = target.type === "channel" && d ? overwritesSynced(d.overwrites) : true;

  return (
    <Dialog title={`Permissions · ${title}`} onClose={onClose} wide>
      <div className="dialog-body">
        {loaded.error && !d && (
          <div className="banner danger" role="alert">
            {loaded.error}
          </div>
        )}
        {!d && !loaded.error && <span className="skeleton" style={{ height: 180 }} />}
        {d && (
          <>
            <p className="muted" style={{ margin: 0 }}>
              {target.type === "category"
                ? "Its channels follow these rules unless they have their own. Owners and admins always have every permission."
                : synced
                  ? "This channel follows its category's permissions. A rule here applies on top of them."
                  : "This channel has rules of its own on top of its category's."}
            </p>
            {target.type === "channel" && !synced && d.canManage && (
              <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void syncTargets(d.overwrites).reduce((p, s) => p.then(() => write(s, [], [])), Promise.resolve())}>
                <RefreshCw size={14} /> Sync with category
              </button>
            )}
            {error && (
              <div className="banner danger" role="alert">
                {error}
              </div>
            )}
            <div className="perm-grid">
              <div className="perm-subjects" role="listbox" aria-label="Roles and members">
                {subjects.map((s) => {
                  const o = listed.find((x) => x.subject === s.subject);
                  const set = !!o && (o.allow.length > 0 || o.deny.length > 0);
                  return (
                    <button key={s.subject} role="option" aria-selected={subject === s.subject} className="side-item" onClick={() => setSubject(s.subject)}>
                      <span className="grow ellipsis">{s.label}</span>
                      {set && <span className="dot" aria-label="has rules" />}
                    </button>
                  );
                })}
              </div>
              <div className="perm-caps">
                {d.capabilities.map((cap) => {
                  const st = overwriteState(current, cap.key);
                  return (
                    <div key={cap.key} className="perm-row">
                      <span className="lines">
                        <strong>{cap.label}</strong>
                        {cap.description && <small>{cap.description}</small>}
                      </span>
                      <div className="segmented perm-tri" role="radiogroup" aria-label={cap.label}>
                        {STATES.map((x) => (
                          <button
                            key={x.state}
                            role="radio"
                            aria-checked={st === x.state}
                            aria-pressed={st === x.state}
                            aria-label={x.label}
                            title={x.label}
                            className={`perm-${x.state}`}
                            disabled={busy || !d.canManage}
                            onClick={() => {
                              const next = withState(current, cap.key, x.state);
                              void write(subject, next.allow, next.deny);
                            }}
                          >
                            {x.icon}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {!d.canManage && (
              <p className="faint" style={{ margin: 0 }}>
                You can see these rules but not change them.
              </p>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
