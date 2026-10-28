import { Check, MessageCircle, MoreVertical, Search, UserMinus, UserPlus, UsersRound, X } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import type { Member } from "../../api/schemas";
import { ApiError } from "../../api/client";
import { shallowEqual, useEngine, useOrbit } from "../../application/orbit";
import { navigate } from "../../application/router";
import { startDirect, userProfile } from "../../sync/account";
import { block, blockedIds, unblock } from "../../sync/profile";
import { acceptConnection, cleanUsername, connect, connections, removeConnection } from "../../sync/social";
import { Menu, useMenu } from "../components/Overlay";
import { LookAvatar, StyledName, useUserLook } from "../people/NameStyle";
import { useLoad } from "../workspace/useLoad";

type Tab = "online" | "all" | "pending" | "blocked" | "suggested" | "add";

interface Person {
  id: string;
  username: string;
  displayName: string;
  avatarColor: number;
  statusText: string | null;
}

/**
 * Friends (2026-10-28, after the owner's reference): the Messages home on a wide window and its own page on phones.
 * Online, All, Pending (requests to and from you), Blocked, Suggested (people from your communities you aren't
 * connected with yet: worked out on this browser from who you share conversations with, never sent anywhere) and Add
 * Friend by username. Every row can open a conversation; the server decides every request.
 */
export function FriendsView() {
  const engine = useEngine();
  const rev = useOrbit((s) => s.connectionsRev);
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<Tab>("online");
  const [q, setQ] = useState("");
  const list = useLoad(() => connections(engine), [engine, rev, tick]);
  const blocked = useLoad(
    async () =>
      Promise.all(
        (await blockedIds(engine)).map((id) =>
          userProfile(engine, id).then(
            (u): Person => ({ id, username: u.username, displayName: u.displayName, avatarColor: u.avatarColor, statusText: null }),
            (): Person => ({ id, username: "", displayName: "Someone", avatarColor: 0, statusText: null }),
          ),
        ),
      ),
    [engine, tab === "blocked", tick],
  );
  const me = useOrbit((s) => s.me?.userId ?? "");
  const online = useOrbit((s) => Object.fromEntries(Object.values(s.users).map((u) => [u.id, u.online === true && u.presence !== "offline"])), shallowEqual);
  const known = useOrbit(
    (s) => Object.values(s.users).map((u): Person => ({ id: u.id, username: u.username, displayName: u.displayName, avatarColor: u.avatarColor, statusText: u.statusText ?? null })),
    (a, b) => a.length === b.length && a.every((x, i) => x.id === b[i].id && x.displayName === b[i].displayName),
  );
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    setNote(null);
    try {
      await fn();
      setTick((t) => t + 1);
      if (ok) setNote({ ok: true, text: ok });
    } catch (e) {
      setNote({ ok: false, text: e instanceof ApiError ? e.message : "That didn't work. Try again." });
    } finally {
      setBusy(false);
    }
  };
  const message = (id: string) =>
    void startDirect(engine, id)
      .then((cid) => navigate({ section: "dms", conversationId: cid }))
      .catch(() => engine.notice("error", "Couldn't open that conversation."));

  const friends = useMemo(() => list.data?.connected ?? [], [list.data]);
  const incoming = useMemo(() => list.data?.incoming ?? [], [list.data]);
  const outgoing = useMemo(() => list.data?.outgoing ?? [], [list.data]);
  const suggested = useMemo(() => {
    const taken = new Set([me, ...friends.map((f) => f.id), ...incoming.map((r) => r.user.id), ...outgoing.map((r) => r.user.id), ...(blocked.data ?? []).map((b) => b.id)]);
    return known.filter((p) => !taken.has(p.id) && p.username);
  }, [known, friends, incoming, outgoing, blocked.data, me]);
  const match = (p: { displayName: string; username: string }) => !q.trim() || `${p.displayName} ${p.username}`.toLowerCase().includes(q.trim().toLowerCase());

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "online", label: "Online" },
    { key: "all", label: "All" },
    { key: "pending", label: "Pending", count: incoming.length },
    { key: "blocked", label: "Blocked" },
    { key: "suggested", label: "Suggested" },
  ];
  const rows = (people: Member[] | Person[]) => people.filter(match);
  const shownOnline = rows(friends).filter((f) => online[f.id]);

  return (
    <section className="main friends" aria-label="Friends">
      <header className="friends-head">
        <span className="friends-title">
          <UsersRound size={19} aria-hidden="true" /> Friends
        </span>
        <span className="friends-sep" aria-hidden="true" />
        <div className="friends-tabs" role="tablist" aria-label="Friends">
          {tabs.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} className="friends-tab" onClick={() => setTab(t.key)}>
              {t.label}
              {t.count ? <span className="count mention-count">{t.count}</span> : null}
            </button>
          ))}
          <button role="tab" aria-selected={tab === "add"} className="friends-tab add" onClick={() => setTab("add")}>
            Add Friend
          </button>
        </div>
      </header>
      <div className="friends-body scroll">
        {note && (
          <div className={`banner${note.ok ? " ok" : " danger"}`} role={note.ok ? "status" : "alert"}>
            {note.text}
          </div>
        )}
        {tab === "add" ? (
          <AddFriend busy={busy} onAdd={(u) => run(() => connect(engine, { username: u }), `Friend request sent to @${u}. You'll be connected when they accept.`)} />
        ) : (
          <>
            <label className="friends-search input">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search friends" />
              <Search size={17} className="faint" aria-hidden="true" />
            </label>
            {list.loading && !list.data ? (
              <p className="faint">Loading…</p>
            ) : tab === "online" ? (
              <Group title={`Online — ${shownOnline.length}`} empty="Nobody's online right now.">
                {shownOnline.map((p) => (
                  <FriendRow key={p.id} p={p} online onMessage={() => message(p.id)} more={[{ label: "Remove friend", danger: true, run: () => run(() => removeConnection(engine, p.id)) }]} />
                ))}
              </Group>
            ) : tab === "all" ? (
              <Group title={`All friends — ${rows(friends).length}`} empty="No friends yet. Add one by their username, or connect from a profile.">
                {rows(friends).map((p) => (
                  <FriendRow
                    key={p.id}
                    p={p}
                    online={!!online[p.id]}
                    onMessage={() => message(p.id)}
                    more={[{ label: "Remove friend", danger: true, run: () => run(() => removeConnection(engine, p.id)) }]}
                  />
                ))}
              </Group>
            ) : tab === "pending" ? (
              <>
                <Group title={`Waiting for you — ${incoming.filter((r) => match(r.user)).length}`} empty="No requests waiting for you.">
                  {incoming
                    .filter((r) => match(r.user))
                    .map((r) => (
                      <FriendRow
                        key={r.user.id}
                        p={r.user}
                        online={!!online[r.user.id]}
                        sub="Wants to connect"
                        actions={
                          <>
                            <button
                              className="icon-btn friend-accept"
                              disabled={busy}
                              onClick={() => run(() => acceptConnection(engine, r.user.id), `You're connected with ${r.user.displayName}.`)}
                              aria-label={`Accept ${r.user.displayName}`}
                              title="Accept"
                            >
                              <Check size={18} />
                            </button>
                            <button
                              className="icon-btn friend-decline"
                              disabled={busy}
                              onClick={() => run(() => removeConnection(engine, r.user.id))}
                              aria-label={`Decline ${r.user.displayName}`}
                              title="Decline"
                            >
                              <X size={18} />
                            </button>
                          </>
                        }
                      />
                    ))}
                </Group>
                <Group title={`Sent — ${outgoing.filter((r) => match(r.user)).length}`} empty="No requests sent.">
                  {outgoing
                    .filter((r) => match(r.user))
                    .map((r) => (
                      <FriendRow
                        key={r.user.id}
                        p={r.user}
                        online={!!online[r.user.id]}
                        sub="Request sent"
                        actions={
                          <button
                            className="icon-btn friend-decline"
                            disabled={busy}
                            onClick={() => run(() => removeConnection(engine, r.user.id))}
                            aria-label={`Cancel the request to ${r.user.displayName}`}
                            title="Cancel"
                          >
                            <X size={18} />
                          </button>
                        }
                      />
                    ))}
                </Group>
              </>
            ) : tab === "blocked" ? (
              <Group title={`Blocked — ${rows(blocked.data ?? []).length}`} empty="You haven't blocked anyone.">
                {rows(blocked.data ?? []).map((p) => (
                  <FriendRow
                    key={p.id}
                    p={p}
                    online={false}
                    sub="Blocked"
                    actions={
                      <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => run(() => unblock(engine, p.id), `${p.displayName} is unblocked.`)}>
                        Unblock
                      </button>
                    }
                  />
                ))}
              </Group>
            ) : (
              <Group title={`From your communities — ${rows(suggested).length}`} empty="No one to suggest yet. People you share communities and groups with show here.">
                {rows(suggested)
                  .slice(0, 100)
                  .map((p) => (
                    <FriendRow
                      key={p.id}
                      p={p}
                      online={!!online[p.id]}
                      onMessage={() => message(p.id)}
                      actions={
                        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => run(() => connect(engine, { userId: p.id }), `Friend request sent to ${p.displayName}.`)}>
                          <UserPlus size={14} aria-hidden="true" /> Add
                        </button>
                      }
                      more={[{ label: "Block", danger: true, run: () => run(() => block(engine, p.id), `${p.displayName} is blocked.`) }]}
                    />
                  ))}
              </Group>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function Group({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <div className="friends-group">
      <h3>{title}</h3>
      {children.length ? <div role="list">{children}</div> : <p className="friends-empty">{empty}</p>}
    </div>
  );
}

function FriendRow(p: {
  p: { id: string; username: string; displayName: string; avatarColor: number; statusText?: string | null };
  online: boolean;
  sub?: string;
  onMessage?: () => void;
  actions?: React.ReactNode;
  more?: { label: string; danger?: boolean; run: () => void }[];
}) {
  const look = useUserLook(p.p.id);
  const photo = useOrbit((s) => s.users[p.p.id]?.photoRev ?? null);
  const menu = useMenu();
  return (
    <div className="friend-row" role="listitem">
      <LookAvatar userId={p.p.id} name={p.p.displayName} colorIndex={p.p.avatarColor} photoRev={photo} size={36} online={p.online} />
      <span className="lines grow">
        <strong className="ellipsis">
          <StyledName name={p.p.displayName} style={look.profileStyle} tag={look.tag} mojo={look.mojo} className="ellipsis" />
          {p.p.username && <small className="friend-handle"> @{p.p.username}</small>}
        </strong>
        <small className="ellipsis">{p.sub ?? (p.p.statusText || (p.online ? "Online" : "Offline"))}</small>
      </span>
      <span className="friend-actions">
        {p.actions}
        {p.onMessage && (
          <button className="icon-btn" onClick={p.onMessage} aria-label={`Message ${p.p.displayName}`} title="Message">
            <MessageCircle size={18} />
          </button>
        )}
        {p.more && (
          <button className="icon-btn" onClick={(e) => menu.open(e.currentTarget)} aria-label={`More for ${p.p.displayName}`} aria-haspopup="menu">
            <MoreVertical size={18} />
          </button>
        )}
      </span>
      {menu.anchor && p.more && (
        <Menu
          anchor={menu.anchor}
          align="end"
          label={p.p.displayName}
          onClose={menu.close}
          entries={p.more.map((m) => ({ label: m.label, danger: m.danger, icon: <UserMinus size={16} />, onSelect: m.run }))}
        />
      )}
    </div>
  );
}

function AddFriend({ busy, onAdd }: { busy: boolean; onAdd: (username: string) => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const u = cleanUsername(name);
    if (!u) return setError("Type their username, like @nahian.");
    setError(null);
    onAdd(u);
    setName("");
  };
  return (
    <form className="add-friend" onSubmit={submit}>
      <h2>Add Friend</h2>
      <p className="faint">You can add friends with their Meldiq username.</p>
      <div className="add-friend-box">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Their username, like @nahian" aria-label="Username" data-autofocus />
        <button className="btn btn-primary" disabled={busy || !name.trim()}>
          Send Friend Request
        </button>
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
