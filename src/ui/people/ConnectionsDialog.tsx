import { Check, MailQuestion, UserPlus, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { ApiError } from "../../api/client";
import type { Member } from "../../api/schemas";
import { shallowEqual, useEngine, useOrbit } from "../../application/orbit";
import { navigate } from "../../application/router";
import { acceptConnection, cleanUsername, connect, connections, removeConnection } from "../../sync/social";
import { UserAvatar } from "../components/OrgAvatar";
import { Dialog } from "../components/Overlay";
import { shortWhen } from "../format";
import { messageRequests } from "../selectors";
import { useLoad } from "../workspace/useLoad";
import { openProfile } from "./ProfileDialog";

/**
 * Connections (batch B6, android ConnectionsScreens): requests for you (Accept / Decline), the ones you sent (Cancel),
 * the people you're connected with, and Add by username. Crossed requests connect at once; nobody is told of a
 * decline or a removal.
 */
export function ConnectionsDialog({ onClose }: { onClose: () => void }) {
  const engine = useEngine();
  const rev = useOrbit((s) => s.connectionsRev);
  const [tick, setTick] = useState(0);
  const list = useLoad(() => connections(engine), [engine, rev, tick]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await fn();
      setTick((t) => t + 1);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const add = (e: FormEvent) => {
    e.preventDefault();
    const u = cleanUsername(name);
    if (!u) return setError("Type their username.");
    void run(async () => {
      const state = await connect(engine, { username: u });
      setName("");
      setInfo(state === "accepted" ? `You're connected with @${u}.` : `Request sent to @${u}.`);
    });
  };
  const d = list.data;
  return (
    <Dialog title="Connections" onClose={onClose} wide>
      <div className="dialog-body">
        <form className="row" style={{ gap: 6 }} onSubmit={add}>
          <input className="input" data-autofocus value={name} maxLength={65} onChange={(e) => setName(e.target.value)} placeholder="Add by username" aria-label="Add by username" autoComplete="off" />
          <button className="btn btn-primary" disabled={busy}>
            <UserPlus size={15} /> Send
          </button>
        </form>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        {info && (
          <div className="banner info" role="status">
            {info}
          </div>
        )}
        {list.error && !d && <div className="banner danger">{list.error}</div>}
        {!d && !list.error && <span className="skeleton" style={{ height: 120 }} />}
        {d && (
          <>
            <Group title={`Requests for you${d.incoming.length ? ` · ${d.incoming.length}` : ""}`} empty="No requests.">
              {d.incoming.map((e) => (
                <PersonRow key={e.user.id} user={e.user} sub={`Asked ${shortWhen(e.at)}`}>
                  <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void run(() => acceptConnection(engine, e.user.id))}>
                    <Check size={14} /> Accept
                  </button>
                  <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void run(() => removeConnection(engine, e.user.id))}>
                    <X size={14} /> Decline
                  </button>
                </PersonRow>
              ))}
            </Group>
            <Group title="Sent" empty="No requests waiting.">
              {d.outgoing.map((e) => (
                <PersonRow key={e.user.id} user={e.user} sub={`Sent ${shortWhen(e.at)}`}>
                  <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void run(() => removeConnection(engine, e.user.id))}>
                    Cancel
                  </button>
                </PersonRow>
              ))}
            </Group>
            <Group title={`Connected${d.connected.length ? ` · ${d.connected.length}` : ""}`} empty="No connections yet. Connected people can always message you directly.">
              {d.connected.map((u) => (
                <PersonRow key={u.id} user={u} />
              ))}
            </Group>
          </>
        )}
      </div>
    </Dialog>
  );
}

function Group({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <section aria-label={title}>
      <h3 className="ws-subhead">{title}</h3>
      {children.length ? (
        <div style={{ display: "grid", gap: 2 }}>{children}</div>
      ) : (
        <p className="faint" style={{ margin: 0 }}>
          {empty}
        </p>
      )}
    </section>
  );
}

function PersonRow({ user, sub, children }: { user: Member; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="list-row">
      <UserAvatar userId={user.id} name={user.displayName} colorIndex={user.avatarColor} photoRev={user.photoRev} size={36} online={user.online} presence={user.presence} decorative />
      <span className="lines">
        <button className="person-name ellipsis" onClick={() => openProfile(user.id, user.displayName)}>
          {user.displayName}
        </button>
        <small className="ellipsis">
          @{user.username}
          {sub ? ` · ${sub}` : ""}
        </small>
      </span>
      {children}
    </div>
  );
}

/** Message requests (batch B6): DMs from people your settings don't let message you directly, waiting for an answer. */
export function MessageRequestsDialog({ onClose }: { onClose: () => void }) {
  const ids = useOrbit((s) => messageRequests(s).map((c) => c.id), shallowEqual);
  const rows = useOrbit(
    (s) =>
      ids.map((id) => {
        const c = s.conversations[id];
        const peer = c?.members?.find((m) => m.id !== s.me?.userId);
        return { id, name: peer ? (s.users[peer.id]?.displayName ?? peer.displayName) : "Someone", peer, preview: s.local[id]?.lastPreview ?? null };
      }),
    (a, b) => JSON.stringify(a) === JSON.stringify(b),
  );
  return (
    <Dialog title="Message requests" onClose={onClose}>
      <div className="dialog-body">
        <p className="muted" style={{ margin: 0 }}>
          People your settings don't let message you directly. They arrive without a notification; nothing you do is shown to them unless you accept.
        </p>
        {rows.length === 0 && (
          <div className="empty" style={{ padding: 20 }}>
            <span className="empty-orb">
              <MailQuestion size={22} />
            </span>
            <p className="muted">No message requests.</p>
          </div>
        )}
        <div style={{ display: "grid", gap: 2 }}>
          {rows.map((r) => (
            <button
              key={r.id}
              className="list-row"
              onClick={() => {
                onClose();
                navigate({ section: "dms", conversationId: r.id });
              }}
            >
              {r.peer && <UserAvatar userId={r.peer.id} name={r.name} colorIndex={r.peer.avatarColor} photoRev={r.peer.photoRev} size={36} decorative />}
              <span className="lines">
                <span style={{ fontWeight: 600 }} className="ellipsis">
                  {r.name}
                </span>
                <small className="ellipsis">{r.preview ?? "Wants to message you"}</small>
              </span>
            </button>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
