import { ShieldBan } from "lucide-react";
import { UNKNOWN } from "../../api/enums";
import { useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { DM_POLICIES, DM_POLICY_LABEL, type DmPolicy, messagingSettings, REQUEST_POLICIES, REQUEST_POLICY_LABEL, type RequestPolicy, setMessagingSettings } from "../../sync/social";
import { type Audience, AUDIENCES, blockedIds, myProfile, type Privacy, type PrivacyField, setPrivacy, unblock } from "../../sync/profile";
import { userProfile } from "../../sync/account";
import { useAction, useLoad } from "../workspace/useLoad";

const FIELDS: { field: PrivacyField; label: string; help: string }[] = [
  { field: "photo", label: "Profile photo", help: "Not end-to-end encrypted: the server stores it." },
  { field: "bio", label: "Bio", help: "" },
  { field: "name", label: "First and last name", help: "" },
  { field: "birthday", label: "Birthday", help: "" },
  { field: "phone", label: "Phone number", help: "" },
  { field: "lastSeen", label: "Online and last seen", help: "Also hides you from presence updates." },
  { field: "findByPhone", label: "Find me by phone number", help: "Exact number only, never a list." },
  { field: "findByUsername", label: "Find me by username", help: "“My contacts” also hides you from other servers' lookups." },
];

const AUDIENCE_LABEL: Record<Audience, string> = { everyone: "Everyone", contacts: "My contacts", nobody: "Nobody" };

/** Who sees each part of the profile (server/src/profile.ts enforces it), and the people this account has blocked. */
export function PrivacySettings() {
  const engine = useEngine();
  const profile = useLoad(() => myProfile(engine), [engine]);
  const [privacy, setLocal] = useState<Partial<Privacy> | null>(null);
  const act = useAction();
  const current = privacy ?? profile.data?.privacy ?? null;
  return (
    <div className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
      <h3 style={{ margin: 0 }}>Who can see your profile</h3>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        "My contacts" are people you share a conversation with, or a workspace where neither of you is a guest. Your username and display name are always visible.
      </p>
      {(profile.error || act.error) && (
        <div className="banner danger" role="alert">
          {profile.error ?? act.error}
        </div>
      )}
      <div style={{ display: "grid", gap: 2 }}>
        {FIELDS.map((f) => (
          <div key={f.field} className="ws-row">
            <span className="lines grow">
              <span>{f.label}</span>
              {f.help && <small>{f.help}</small>}
            </span>
            <select
              className="input input-sm"
              aria-label={f.label}
              disabled={!current || act.busy}
              value={current?.[f.field] ?? "everyone"}
              onChange={(e) => {
                const value = e.target.value as Audience;
                void act.act(async () => setLocal(await setPrivacy(engine, { [f.field]: value })));
              }}
            >
              {AUDIENCES.map((a) => (
                <option key={a} value={a}>
                  {AUDIENCE_LABEL[a]}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BlockedPeople() {
  const engine = useEngine();
  const [version, setVersion] = useState(0);
  const list = useLoad(async () => {
    const ids = await blockedIds(engine);
    return Promise.all(
      ids.map(async (id) => ({
        id,
        name: await userProfile(engine, id).then(
          (u) => `${u.displayName} (@${u.username})`,
          () => "Someone",
        ),
      })),
    );
  }, [engine, version]);
  const act = useAction();
  return (
    <div className="card" style={{ padding: 20, display: "grid", gap: 10 }}>
      <h3 style={{ margin: 0 }}>
        <ShieldBan size={16} style={{ verticalAlign: "-3px" }} /> Blocked people
      </h3>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        They see only your username, display name and colour. Block someone from their profile in a conversation's details.
      </p>
      {act.error && <div className="banner danger">{act.error}</div>}
      <ul className="ws-list" aria-label="Blocked people" aria-busy={list.loading}>
        {(list.data ?? []).map((b) => (
          <li key={b.id} className="ws-row">
            <span className="grow ellipsis">{b.name}</span>
            <button className="btn btn-ghost btn-sm" disabled={act.busy} onClick={() => void act.act(() => unblock(engine, b.id).then(() => setVersion((v) => v + 1)))}>
              Unblock
            </button>
          </li>
        ))}
        {list.data?.length === 0 && <li className="faint">Nobody.</li>}
      </ul>
    </div>
  );
}

/**
 * Who can message you (batch B6, android MessagingPrivacy): directly, or as a message request you answer first. Blocked
 * and unknown people get the same answer, so a setting never reveals a block.
 */
export function MessagingSettings() {
  const engine = useEngine();
  const offered = useOrbit((s) => s.server?.features.includes("message-requests") ?? false);
  const loaded = useLoad(() => (offered ? messagingSettings(engine) : Promise.resolve(null)), [engine, offered]);
  const [local, setLocal] = useState<Awaited<ReturnType<typeof messagingSettings>> | null>(null);
  const act = useAction();
  const s = local ?? loaded.data;
  if (!offered) return null;
  return (
    <div className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
      <h3 style={{ margin: 0 }}>Messages</h3>
      {(loaded.error || act.error) && (
        <div className="banner danger" role="alert">
          {loaded.error ?? act.error}
        </div>
      )}
      <div className="ws-row">
        <span className="lines grow">
          <span>Who can message you directly</span>
          <small>Others can send you a message request, which arrives without a notification.</small>
        </span>
        <select
          className="input input-sm"
          aria-label="Who can message you directly"
          disabled={!s || act.busy}
          value={s?.dmPolicy ?? "everyone"}
          onChange={(e) => void act.act(async () => setLocal(await setMessagingSettings(engine, { dmPolicy: e.target.value as DmPolicy })))}
        >
          {s?.dmPolicy === UNKNOWN && (
            <option value={UNKNOWN} disabled>
              Set in a newer version of Meldiq
            </option>
          )}
          {DM_POLICIES.map((p) => (
            <option key={p} value={p}>
              {DM_POLICY_LABEL[p]}
            </option>
          ))}
        </select>
      </div>
      <div className="ws-row">
        <span className="lines grow">
          <span>Who can send you requests</span>
          <small>Message requests and connection requests. Anyone else is told you only accept messages from people you're connected with.</small>
        </span>
        <select
          className="input input-sm"
          aria-label="Who can send you requests"
          disabled={!s || act.busy}
          value={s?.requestPolicy ?? "everyone"}
          onChange={(e) => void act.act(async () => setLocal(await setMessagingSettings(engine, { requestPolicy: e.target.value as RequestPolicy })))}
        >
          {s?.requestPolicy === UNKNOWN && (
            <option value={UNKNOWN} disabled>
              Set in a newer version of Meldiq
            </option>
          )}
          {REQUEST_POLICIES.map((p) => (
            <option key={p} value={p}>
              {REQUEST_POLICY_LABEL[p]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
