import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Ban, Pencil, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import type { Conversation, Member } from "../../api/schemas";
import { useEngine } from "../../application/orbit";
import { searchPeople } from "../../sync/account";
import { block, blockedIds, unblock } from "../../sync/profile";
import { addConversationMember, directory, updateConversation } from "../../sync/workspaces";
import { groupAddProblem } from "../../sync/groupAdd";
import { Dialog } from "../components/Overlay";
import { UserAvatar } from "../components/OrgAvatar";
const NAME_MAX = 60;
const TOPIC_MAX = 250;
const SEARCH_DELAY_MS = 250;
const messageOf = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
/**
 * Renaming a group or channel and editing a channel's topic (android ChannelDetailsSections). Offered only when the server
 * says this person manages the conversation (`canManage`, server authz.canManageConversation); the server checks again.
 */
export function EditConversationButton({ c }: { c: Conversation }) {
  useLocaleRender();
  const l10n = useLocalization();
  const [open, setOpen] = useState(false);
  if (c.type === "DM" || !c.canManage) return null;
  return (
    <>
      <button className="btn btn-secondary btn-sm" style={{ justifySelf: "start" }} onClick={() => setOpen(true)}>
        <Pencil size={14} /> {l10n("common.actions.edit")} {c.type === "CHANNEL" ? uiText("messaging.interface.channel_69e3656") : uiText("messaging.interface.group_ad936fc")}
      </button>
      {open && <EditConversationDialog c={c} onClose={() => setOpen(false)} />}
    </>
  );
}
function EditConversationDialog({ c, onClose }: { c: Conversation; onClose: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const [name, setName] = useState(c.name ?? "");
  const [topic, setTopic] = useState(c.topic ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channel = c.type === "CHANNEL";
  const trimmed = name.trim();
  const problem = !trimmed
    ? uiText("messaging.interface.give_it_a_name_9d63f7c")
    : trimmed.length > NAME_MAX
      ? uiText("messaging.interface.names_are_at_most_value0_characters_1d8c8ce", { value0: NAME_MAX })
      : null;
  const changed = trimmed !== (c.name ?? "") || (channel && (topic.trim() || null) !== (c.topic ?? null));
  const save = async () => {
    if (problem || !changed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await updateConversation(engine, c.id, channel ? { name: trimmed, topic: topic.trim() || null } : { name: trimmed });
      onClose();
    } catch (e) {
      setError(messageOf(e, uiText("messaging.interface.couldn_t_save_the_changes_3488055")));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      title={channel ? uiText("messaging.interface.edit_channel_2f3450a") : uiText("messaging.interface.edit_group_f24f78c")}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            {l10n("common.actions.cancel")}
          </button>
          <button className="btn btn-primary" disabled={!!problem || !changed || busy} onClick={() => void save()}>
            {busy ? l10n("common.common_saving") : l10n("common.actions.save")}
          </button>
        </>
      }
    >
      <form
        className="dialog-body"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <label className="field">
          <span>
            <Localized k="messaging.interface.name_dcd1d52" />
          </span>
          <input className="input" value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} aria-invalid={!!problem} autoFocus />
          {problem && name !== (c.name ?? "") && <span className="hint">{problem}</span>}
        </label>
        {channel && (
          <label className="field">
            <span>
              <Localized k="messaging.interface.topic_7e61847" />
            </span>
            <textarea className="textarea" rows={3} value={topic} maxLength={TOPIC_MAX} onChange={(e) => setTopic(e.target.value)} />
            <span className="hint">
              <Localized k="messaging.interface.shown_under_the_channel_s_name_everyone_in_the_community_who_can_12097e4" />
            </span>
          </label>
        )}
      </form>
    </Dialog>
  );
}
/**
 * Adding people to a group or channel (android ManageSheets). A channel offers its workspace's members (the server refuses
 * anyone outside the channel's branch or team and says why); a group offers anyone the person can find.
 */
export function AddMembersButton({ c, memberIds, onAdded }: { c: Conversation; memberIds: ReadonlySet<string>; onAdded: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const [open, setOpen] = useState(false);
  if (c.type === "DM" || !c.canManage) return null;
  return (
    <>
      <button className="btn btn-secondary btn-sm" style={{ justifySelf: "start" }} onClick={() => setOpen(true)}>
        <UserPlus size={14} /> {l10n("messaging.start_add_people")}
      </button>
      {open && <AddMembersDialog c={c} memberIds={memberIds} onAdded={onAdded} onClose={() => setOpen(false)} />}
    </>
  );
}
export function AddMembersDialog({ c, memberIds, onAdded, onClose }: { c: Conversation; memberIds: ReadonlySet<string>; onAdded: () => void; onClose: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Member[] | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const found = c.type === "CHANNEL" && c.orgId ? await directory(engine, c.orgId, q) : q.trim() ? await searchPeople(engine, q) : [];
        if (alive) setResults(found);
      } catch (e) {
        if (alive) setError(messageOf(e, uiText("messaging.interface.couldn_t_search_1c03676")));
      }
    };
    const t = setTimeout(() => void run(), SEARCH_DELAY_MS);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [engine, c.type, c.orgId, q]);
  const add = async (m: Member) => {
    setBusy(m.id);
    setError(null);
    try {
      await addConversationMember(engine, c.id, m.id);
      setAdded((s) => new Set([...s, m.id]));
      onAdded();
    } catch (e) {
      setError(groupAddProblem(e, () => m.displayName) ?? messageOf(e, uiText("messaging.interface.couldn_t_add_value0_b546c3d", { value0: m.displayName })));
    } finally {
      setBusy(null);
    }
  };
  const candidates = (results ?? []).filter((m) => !memberIds.has(m.id) || added.has(m.id));
  return (
    <Dialog
      title={c.type === "CHANNEL" ? uiText("messaging.interface.add_people_to_this_channel_6223d52") : uiText("messaging.interface.add_people_to_this_group_5495d74")}
      onClose={onClose}
      footer={
        <button className="btn btn-primary" onClick={onClose}>
          {l10n("common.actions.done")}
        </button>
      }
    >
      <div className="dialog-body">
        <input
          className="input"
          placeholder={c.type === "CHANNEL" ? uiText("messaging.interface.search_this_community_s_members_7527326") : uiText("messaging.interface.search_by_name_or_username_851d675")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={uiText("messaging.interface.search_people_8a7e7f1")}
          autoFocus
        />
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        {results === null ? (
          <span className="skeleton" style={{ height: 80 }} />
        ) : candidates.length === 0 ? (
          <p className="faint" style={{ margin: 0 }}>
            {q.trim() || c.type === "CHANNEL" ? uiText("messaging.interface.nobody_to_add_here_97b8ae1") : uiText("messaging.interface.type_a_name_or_username_e960a42")}
          </p>
        ) : (
          <div style={{ display: "grid", gap: 2 }}>
            {candidates.slice(0, 30).map((m) => (
              <div key={m.id} className="person">
                <UserAvatar userId={m.id} name={m.displayName} colorIndex={m.avatarColor} photoRev={m.photoRev} size={32} decorative />
                <div className="lines grow">
                  <span className="ellipsis">{m.displayName}</span>
                  <small className="ellipsis">@{m.username}</small>
                </div>
                {added.has(m.id) ? (
                  <span className="tag ok">
                    <Localized k="messaging.interface.added_6b02e0d" />
                  </span>
                ) : (
                  <button className="btn btn-secondary btn-sm" disabled={busy !== null} onClick={() => void add(m)}>
                    {busy === m.id ? uiText("messaging.interface.adding_c6de6f4") : l10n("common.actions.add")}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="faint" style={{ margin: 0, fontSize: 12 }}>
          <Localized k="messaging.interface.new_members_see_the_conversation_s_earlier_messages_too_2b390cb" />
        </p>
      </div>
    </Dialog>
  );
}
/**
 * Blocking the other person of a direct message (android PrivacyScreen › Blocked): the server drops their messages to you,
 * and they aren't told. Unblocking (here or Settings › Privacy) lets new messages through; dropped ones don't come back.
 */
export function BlockToggle({ userId, name }: { userId: string; name: string }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const [blocked, setBlocked] = useState<boolean | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    blockedIds(engine)
      .then((ids) => alive && setBlocked(ids.includes(userId)))
      .catch(() => alive && setBlocked(null));
    return () => {
      alive = false;
    };
  }, [engine, userId]);
  const change = async (to: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await (to ? block(engine, userId) : unblock(engine, userId));
      setBlocked(to);
      setConfirm(false);
    } catch (e) {
      setError(messageOf(e, to ? uiText("messaging.interface.couldn_t_block_5831eff") : uiText("messaging.interface.couldn_t_unblock_91fc2a5")));
    } finally {
      setBusy(false);
    }
  };
  if (blocked === null) return null;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {error && (
        <div className="banner danger" role="alert">
          {error}
        </div>
      )}
      {blocked ? (
        <div className="row" style={{ gap: 8 }}>
          <span className="tag danger">
            <Localized k="messaging.interface.blocked_55a4e2d" slots={[<Ban size={12} />]} />
          </span>
          <span className="grow faint" style={{ fontSize: 12.5 }}>
            <Localized k="messaging.interface.messages_from_don_t_reach_you_0349a33" slots={[name]} />
          </span>
          <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void change(false)}>
            <Localized k="messaging.interface.unblock_712da63" />
          </button>
        </div>
      ) : confirm ? (
        <div className="row" style={{ gap: 8 }}>
          <span className="grow">
            <Localized k="messaging.interface.block_their_messages_won_t_reach_you_and_they_aren_t_told_b504eb3" slots={[name]} />
          </span>
          <button className="btn btn-secondary btn-sm" onClick={() => setConfirm(false)}>
            {l10n("common.actions.cancel")}
          </button>
          <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => void change(true)}>
            <Localized k="messaging.interface.block_211d0bb" />
          </button>
        </div>
      ) : (
        <button className="btn btn-danger-quiet btn-sm" style={{ justifySelf: "start" }} onClick={() => setConfirm(true)}>
          <Localized k="messaging.interface.block_f220e60" slots={[<Ban size={14} />, name]} />
        </button>
      )}
    </div>
  );
}
