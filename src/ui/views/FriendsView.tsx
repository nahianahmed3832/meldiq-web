import { formatUiNumber } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Check, Search, UserPlus, UsersRound, X } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import type { Member } from "../../api/schemas";
import { ApiError } from "../../api/client";
import { shallowEqual, useEngine, useOrbit } from "../../application/orbit";
import { navigate } from "../../application/router";
import { startDirect, userProfile } from "../../sync/account";
import { block, blockedIds, unblock } from "../../sync/profile";
import { acceptConnection, cleanUsername, connect, connections, removeConnection } from "../../sync/social";
import { FriendRow, Group } from "./FriendRows";
import { SuggestedPeople } from "./SuggestedPeople";
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
 * Online, All, Pending (requests to and from you), Blocked, Suggested (the server's list from shared communities since
 * API 0.65.0; before that, people this browser already knows from shared conversations, never sent anywhere) and Add
 * Friend by username. Every row can open a conversation; the server decides every request.
 */
export function FriendsView() {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const rev = useOrbit((s) => s.connectionsRev);
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<Tab>("online");
  const [q, setQ] = useState("");
  // API 0.65.0: the server suggests people from shared communities who turned "suggest me" on.
  const serverSuggests = useOrbit((s) => s.server?.features.includes("suggested-people") ?? false);
  const list = useLoad(() => connections(engine), [engine, rev, tick]);
  const blocked = useLoad(
    async () =>
      Promise.all(
        (await blockedIds(engine)).map((id) =>
          userProfile(engine, id).then(
            (u): Person => ({ id, username: u.username, displayName: u.displayName, avatarColor: u.avatarColor, statusText: null }),
            (): Person => ({ id, username: "", displayName: uiText("messaging.react_someone"), avatarColor: 0, statusText: null }),
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
  const [note, setNote] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    setNote(null);
    try {
      await fn();
      setTick((t) => t + 1);
      if (ok) setNote({ ok: true, text: ok });
    } catch (e) {
      setNote({ ok: false, text: e instanceof ApiError ? e.message : uiText("workspace.interface.that_didn_t_work_try_again_5da2573") });
    } finally {
      setBusy(false);
    }
  };
  const message = (id: string) =>
    void startDirect(engine, id)
      .then((cid) => navigate({ section: "dms", conversationId: cid }))
      .catch(() => engine.notice("error", uiText("workspace.interface.couldn_t_open_that_conversation_90c6906")));
  const friends = useMemo(() => list.data?.connected ?? [], [list.data]);
  const incoming = useMemo(() => list.data?.incoming ?? [], [list.data]);
  const outgoing = useMemo(() => list.data?.outgoing ?? [], [list.data]);
  const suggested = useMemo(() => {
    const taken = new Set([me, ...friends.map((f) => f.id), ...incoming.map((r) => r.user.id), ...outgoing.map((r) => r.user.id), ...(blocked.data ?? []).map((b) => b.id)]);
    return known.filter((p) => !taken.has(p.id) && p.username);
  }, [known, friends, incoming, outgoing, blocked.data, me]);
  const match = (p: { displayName: string; username: string }) => !q.trim() || `${p.displayName} ${p.username}`.toLowerCase().includes(q.trim().toLowerCase());
  const tabs: {
    key: Tab;
    label: string;
    count?: number;
  }[] = [
    { key: "online", label: l10n("workspace.online") },
    { key: "all", label: l10n("settings.ap_all") },
    {
      key: "pending",
      get label() {
        return uiText("workspace.interface.pending_331551b");
      },
      count: incoming.length,
    },
    {
      key: "blocked",
      get label() {
        return uiText("workspace.interface.blocked_18f2a09");
      },
    },
    {
      key: "suggested",
      get label() {
        return uiText("workspace.interface.suggested_93b63ba");
      },
    },
  ];
  const rows = (people: Member[] | Person[]) => people.filter(match);
  const shownOnline = rows(friends).filter((f) => online[f.id]);
  return (
    <section className="main friends" aria-label={l10n("workspace.friends")}>
      <header className="friends-head">
        <span className="friends-title">
          <UsersRound size={19} aria-hidden="true" /> {l10n("workspace.friends")}
        </span>
        <span className="friends-sep" aria-hidden="true" />
        <div className="friends-tabs" role="tablist" aria-label={l10n("workspace.friends")}>
          {tabs.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} className="friends-tab" onClick={() => setTab(t.key)}>
              {t.label}
              {t.count ? <span className="count mention-count">{formatUiNumber(t.count)}</span> : null}
            </button>
          ))}
          <button role="tab" aria-selected={tab === "add"} className="friends-tab add" onClick={() => setTab("add")}>
            <Localized k="workspace.interface.add_friend_0967ca7" />
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
          <AddFriend
            busy={busy}
            onAdd={(u) => run(() => connect(engine, { username: u }), uiText("workspace.interface.friend_request_sent_to_value0_you_ll_be_connected_when_they_accep_ca3915a", { value0: u }))}
          />
        ) : (
          <>
            <label className="friends-search input">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={l10n("common.actions.search")} aria-label={uiText("workspace.interface.search_friends_9d92d9f")} />
              <Search size={17} className="faint" aria-hidden="true" />
            </label>
            {list.loading && !list.data ? (
              <p className="faint">{l10n("common.status.loading")}</p>
            ) : tab === "online" ? (
              <Group title={uiText("workspace.interface.online_value0_e20063d", { value0: shownOnline.length })} empty={uiText("workspace.interface.nobody_s_online_right_now_41da499")}>
                {shownOnline.map((p) => (
                  <FriendRow
                    key={p.id}
                    p={p}
                    online
                    onMessage={() => message(p.id)}
                    more={[
                      {
                        get label() {
                          return uiText("workspace.interface.remove_friend_f2c4fc8");
                        },
                        danger: true,
                        run: () => run(() => removeConnection(engine, p.id)),
                      },
                    ]}
                  />
                ))}
              </Group>
            ) : tab === "all" ? (
              <Group
                title={uiText("workspace.interface.all_friends_value0_57432ef", { value0: rows(friends).length })}
                empty={uiText("workspace.interface.no_friends_yet_add_one_by_their_username_or_connect_from_a_p_1743cef")}
              >
                {rows(friends).map((p) => (
                  <FriendRow
                    key={p.id}
                    p={p}
                    online={!!online[p.id]}
                    onMessage={() => message(p.id)}
                    more={[
                      {
                        get label() {
                          return uiText("workspace.interface.remove_friend_f2c4fc8");
                        },
                        danger: true,
                        run: () => run(() => removeConnection(engine, p.id)),
                      },
                    ]}
                  />
                ))}
              </Group>
            ) : tab === "pending" ? (
              <>
                <Group
                  title={uiText("workspace.interface.waiting_for_you_value0_1525280", { value0: incoming.filter((r) => match(r.user)).length })}
                  empty={uiText("workspace.interface.no_requests_waiting_for_you_d8a4a16")}
                >
                  {incoming
                    .filter((r) => match(r.user))
                    .map((r) => (
                      <FriendRow
                        key={r.user.id}
                        p={r.user}
                        online={!!online[r.user.id]}
                        sub={uiText("workspace.interface.wants_to_connect_469da2b")}
                        actions={
                          <>
                            <button
                              className="icon-btn friend-accept"
                              disabled={busy}
                              onClick={() => run(() => acceptConnection(engine, r.user.id), uiText("workspace.interface.you_re_connected_with_value0_d8f9185", { value0: r.user.displayName }))}
                              aria-label={uiText("workspace.interface.accept_value0_e142e73", { value0: r.user.displayName })}
                              title={l10n("calls.accept")}
                            >
                              <Check size={18} />
                            </button>
                            <button
                              className="icon-btn friend-decline"
                              disabled={busy}
                              onClick={() => run(() => removeConnection(engine, r.user.id))}
                              aria-label={uiText("workspace.interface.decline_value0_8f5768c", { value0: r.user.displayName })}
                              title={l10n("calls.decline")}
                            >
                              <X size={18} />
                            </button>
                          </>
                        }
                      />
                    ))}
                </Group>
                <Group
                  title={uiText("workspace.interface.sent_value0_68876a8", { value0: outgoing.filter((r) => match(r.user)).length })}
                  empty={uiText("workspace.interface.no_requests_sent_42b0701")}
                >
                  {outgoing
                    .filter((r) => match(r.user))
                    .map((r) => (
                      <FriendRow
                        key={r.user.id}
                        p={r.user}
                        online={!!online[r.user.id]}
                        sub={uiText("workspace.interface.request_sent_a73f99f")}
                        actions={
                          <button
                            className="icon-btn friend-decline"
                            disabled={busy}
                            onClick={() => run(() => removeConnection(engine, r.user.id))}
                            aria-label={uiText("workspace.interface.cancel_the_request_to_value0_43e1299", { value0: r.user.displayName })}
                            title={l10n("common.actions.cancel")}
                          >
                            <X size={18} />
                          </button>
                        }
                      />
                    ))}
                </Group>
              </>
            ) : tab === "blocked" ? (
              <Group title={uiText("workspace.interface.blocked_value0_ca1bc72", { value0: rows(blocked.data ?? []).length })} empty={uiText("workspace.interface.you_haven_t_blocked_anyone_5c43a28")}>
                {rows(blocked.data ?? []).map((p) => (
                  <FriendRow
                    key={p.id}
                    p={p}
                    online={false}
                    sub={uiText("workspace.interface.blocked_18f2a09")}
                    actions={
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={busy}
                        onClick={() => run(() => unblock(engine, p.id), uiText("workspace.interface.value0_is_unblocked_240083d", { value0: p.displayName }))}
                      >
                        <Localized k="messaging.interface.unblock_712da63" />
                      </button>
                    }
                  />
                ))}
              </Group>
            ) : serverSuggests ? (
              <SuggestedPeople engine={engine} rev={rev + tick} busy={busy} online={online} match={match} run={(fn, ok) => void run(fn, ok)} onMessage={message} />
            ) : (
              <Group
                title={uiText("workspace.interface.from_your_communities_value0_2e19b50", { value0: rows(suggested).length })}
                empty={uiText("workspace.interface.no_one_to_suggest_yet_people_you_share_communities_and_group_9f06974")}
              >
                {rows(suggested)
                  .slice(0, 100)
                  .map((p) => (
                    <FriendRow
                      key={p.id}
                      p={p}
                      online={!!online[p.id]}
                      onMessage={() => message(p.id)}
                      actions={
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={busy}
                          onClick={() => run(() => connect(engine, { userId: p.id }), uiText("workspace.interface.friend_request_sent_to_value0_65eed36", { value0: p.displayName }))}
                        >
                          <UserPlus size={14} aria-hidden="true" /> {l10n("common.actions.add")}
                        </button>
                      }
                      more={[
                        {
                          get label() {
                            return uiText("messaging.interface.block_211d0bb");
                          },
                          danger: true,
                          run: () => run(() => block(engine, p.id), uiText("workspace.interface.value0_is_blocked_37959f6", { value0: p.displayName })),
                        },
                      ]}
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
function AddFriend({ busy, onAdd }: { busy: boolean; onAdd: (username: string) => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const u = cleanUsername(name);
    if (!u) return setError(uiText("workspace.interface.type_their_username_like_nahian_98f2338"));
    setError(null);
    onAdd(u);
    setName("");
  };
  return (
    <form className="add-friend" onSubmit={submit}>
      <h2>
        <Localized k="workspace.interface.add_friend_0967ca7" />
      </h2>
      <p className="faint">
        <Localized k="workspace.interface.you_can_add_friends_with_their_meldiq_username_2ca8817" />
      </p>
      <div className="add-friend-box">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={uiText("workspace.interface.their_username_like_nahian_3ee28fa")}
          aria-label={l10n("auth.username")}
          data-autofocus
        />
        <button className="btn btn-primary" disabled={busy || !name.trim()}>
          <Localized k="workspace.interface.send_friend_request_dd1d3d4" />
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
