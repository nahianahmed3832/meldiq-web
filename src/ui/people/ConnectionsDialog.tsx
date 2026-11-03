import { conversationPreview } from "../../sync/rules";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { MeldlingArt } from "../components/MeldlingArt";
import { Check, UserPlus, X } from "lucide-react";
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
  useLocaleRender();
  const l10n = useLocalization();
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
      setError(e instanceof ApiError ? e.message : uiText("workspace.interface.that_didn_t_work_try_again_5da2573"));
    } finally {
      setBusy(false);
    }
  };
  const add = (e: FormEvent) => {
    e.preventDefault();
    const u = cleanUsername(name);
    if (!u) return setError(uiText("workspace.interface.type_their_username_67c96d9"));
    void run(async () => {
      const state = await connect(engine, { username: u });
      setName("");
      setInfo(state === "accepted" ? uiText("workspace.interface.you_re_connected_with_value0_bf6664f", { value0: u }) : uiText("workspace.interface.request_sent_to_value0_2a0fb79", { value0: u }));
    });
  };
  const d = list.data;
  return (
    <Dialog title={l10n("workspace.side_connections")} onClose={onClose} wide>
      <div className="dialog-body">
        <form className="row" style={{ gap: 6 }} onSubmit={add}>
          <input
            className="input"
            data-autofocus
            value={name}
            maxLength={65}
            onChange={(e) => setName(e.target.value)}
            placeholder={uiText("workspace.interface.add_by_username_3eedd21")}
            aria-label={uiText("workspace.interface.add_by_username_3eedd21")}
            autoComplete="off"
          />
          <button className="btn btn-primary" disabled={busy}>
            <UserPlus size={15} /> {l10n("messaging.send")}
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
            <Group
              title={uiText("workspace.interface.requests_for_you_value0_2a72378", { value0: d.incoming.length ? ` · ${d.incoming.length}` : "" })}
              empty={uiText("workspace.interface.no_requests_ef2638b")}
            >
              {d.incoming.map((e) => (
                <PersonRow key={e.user.id} user={e.user} sub={uiText("workspace.interface.asked_value0_cb1eaf9", { value0: shortWhen(e.at) })}>
                  <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void run(() => acceptConnection(engine, e.user.id))}>
                    <Check size={14} /> {l10n("calls.accept")}
                  </button>
                  <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void run(() => removeConnection(engine, e.user.id))}>
                    <X size={14} /> {l10n("calls.decline")}
                  </button>
                </PersonRow>
              ))}
            </Group>
            <Group title={uiText("messaging.interface.sent_c16bc82")} empty={uiText("workspace.interface.no_requests_waiting_8624e9b")}>
              {d.outgoing.map((e) => (
                <PersonRow key={e.user.id} user={e.user} sub={uiText("workspace.interface.sent_value0_e077fe1", { value0: shortWhen(e.at) })}>
                  <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void run(() => removeConnection(engine, e.user.id))}>
                    {l10n("common.actions.cancel")}
                  </button>
                </PersonRow>
              ))}
            </Group>
            <Group
              title={uiText("workspace.interface.connected_value0_c71ef9d", { value0: d.connected.length ? ` · ${d.connected.length}` : "" })}
              empty={uiText("workspace.interface.no_connections_yet_connected_people_can_always_message_you_d_b063b5e")}
            >
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
  useLocaleRender();
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
  useLocaleRender();
  return (
    <div className="list-row">
      <UserAvatar userId={user.id} name={user.displayName} colorIndex={user.avatarColor} photoRev={user.photoRev} size={36} online={user.online} presence={user.presence} decorative />
      <span className="lines">
        <button className="person-name ellipsis" onClick={() => openProfile(user.id, user.displayName)}>
          {user.displayName}
        </button>
        <small className="ellipsis">
          @{user.username}
          {sub ? uiText("calls.interface.value0_9402340", { value0: sub }) : ""}
        </small>
      </span>
      {children}
    </div>
  );
}
/** Message requests (batch B6): DMs from people your settings don't let message you directly, waiting for an answer. */
export function MessageRequestsDialog({ onClose }: { onClose: () => void }) {
  useLocaleRender();
  const ids = useOrbit((s) => messageRequests(s).map((c) => c.id), shallowEqual);
  const rows = useOrbit(
    (s) =>
      ids.map((id) => {
        const c = s.conversations[id];
        const peer = c?.members?.find((m) => m.id !== s.me?.userId);
        return { id, name: peer ? (s.users[peer.id]?.displayName ?? peer.displayName) : uiText("messaging.react_someone"), peer, preview: conversationPreview(s.local[id]) };
      }),
    (a, b) => JSON.stringify(a) === JSON.stringify(b),
  );
  return (
    <Dialog title={uiText("workspace.interface.message_requests_0b48a08")} onClose={onClose}>
      <div className="dialog-body">
        <p className="muted" style={{ margin: 0 }}>
          <Localized k="workspace.interface.people_your_settings_don_t_let_message_you_directly_they_arrive_w_abc309c" />
        </p>
        {rows.length === 0 && (
          <div className="empty" style={{ padding: 20 }}>
            <MeldlingArt pose="love" />
            <p className="muted">
              <Localized k="workspace.interface.no_message_requests_4e7d890" />
            </p>
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
                <small className="ellipsis">{r.preview ?? uiText("workspace.interface.wants_to_message_you_4de9fba")}</small>
              </span>
            </button>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
