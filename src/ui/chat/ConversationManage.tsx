import { Ban, Pencil, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import type { Conversation, Member } from "../../api/schemas";
import { useEngine } from "../../application/orbit";
import { searchPeople } from "../../sync/account";
import { block, blockedIds, unblock } from "../../sync/profile";
import { addConversationMember, directory, updateConversation } from "../../sync/workspaces";
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
  const [open, setOpen] = useState(false);
  if (c.type === "DM" || !c.canManage) return null;
  return (
    <>
      <button className="btn btn-secondary btn-sm" style={{ justifySelf: "start" }} onClick={() => setOpen(true)}>
        <Pencil size={14} /> Edit {c.type === "CHANNEL" ? "channel" : "group"}
      </button>
      {open && <EditConversationDialog c={c} onClose={() => setOpen(false)} />}
    </>
  );
}

function EditConversationDialog({ c, onClose }: { c: Conversation; onClose: () => void }) {
  const engine = useEngine();
  const [name, setName] = useState(c.name ?? "");
  const [topic, setTopic] = useState(c.topic ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channel = c.type === "CHANNEL";
  const trimmed = name.trim();
  const problem = !trimmed ? "Give it a name." : trimmed.length > NAME_MAX ? `Names are at most ${NAME_MAX} characters.` : null;
  const changed = trimmed !== (c.name ?? "") || (channel && (topic.trim() || null) !== (c.topic ?? null));

  const save = async () => {
    if (problem || !changed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await updateConversation(engine, c.id, channel ? { name: trimmed, topic: topic.trim() || null } : { name: trimmed });
      onClose();
    } catch (e) {
      setError(messageOf(e, "Couldn't save the changes."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={channel ? "Edit channel" : "Edit group"}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!!problem || !changed || busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Save"}
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
          <span>Name</span>
          <input className="input" value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} aria-invalid={!!problem} autoFocus />
          {problem && name !== (c.name ?? "") && <span className="hint">{problem}</span>}
        </label>
        {channel && (
          <label className="field">
            <span>Topic</span>
            <textarea className="textarea" rows={3} value={topic} maxLength={TOPIC_MAX} onChange={(e) => setTopic(e.target.value)} />
            <span className="hint">Shown under the channel's name. Everyone in the community who can see the channel sees it.</span>
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
  const [open, setOpen] = useState(false);
  if (c.type === "DM" || !c.canManage) return null;
  return (
    <>
      <button className="btn btn-secondary btn-sm" style={{ justifySelf: "start" }} onClick={() => setOpen(true)}>
        <UserPlus size={14} /> Add people
      </button>
      {open && <AddMembersDialog c={c} memberIds={memberIds} onAdded={onAdded} onClose={() => setOpen(false)} />}
    </>
  );
}

export function AddMembersDialog({ c, memberIds, onAdded, onClose }: { c: Conversation; memberIds: ReadonlySet<string>; onAdded: () => void; onClose: () => void }) {
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
        if (alive) setError(messageOf(e, "Couldn't search."));
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
      setError(messageOf(e, `Couldn't add ${m.displayName}.`));
    } finally {
      setBusy(null);
    }
  };

  const candidates = (results ?? []).filter((m) => !memberIds.has(m.id) || added.has(m.id));
  return (
    <Dialog
      title={c.type === "CHANNEL" ? "Add people to this channel" : "Add people to this group"}
      onClose={onClose}
      footer={
        <button className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="dialog-body">
        <input
          className="input"
          placeholder={c.type === "CHANNEL" ? "Search this community's members" : "Search by name or @username"}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search people"
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
            {q.trim() || c.type === "CHANNEL" ? "Nobody to add here." : "Type a name or username."}
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
                  <span className="tag ok">Added</span>
                ) : (
                  <button className="btn btn-secondary btn-sm" disabled={busy !== null} onClick={() => void add(m)}>
                    {busy === m.id ? "Adding…" : "Add"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="faint" style={{ margin: 0, fontSize: 12 }}>
          New members see the conversation's earlier messages too.
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
      setError(messageOf(e, to ? "Couldn't block." : "Couldn't unblock."));
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
            <Ban size={12} /> Blocked
          </span>
          <span className="grow faint" style={{ fontSize: 12.5 }}>
            Messages from {name} don't reach you.
          </span>
          <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void change(false)}>
            Unblock
          </button>
        </div>
      ) : confirm ? (
        <div className="row" style={{ gap: 8 }}>
          <span className="grow">Block {name}? Their messages won't reach you, and they aren't told.</span>
          <button className="btn btn-secondary btn-sm" onClick={() => setConfirm(false)}>
            Cancel
          </button>
          <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => void change(true)}>
            Block
          </button>
        </div>
      ) : (
        <button className="btn btn-danger-quiet btn-sm" style={{ justifySelf: "start" }} onClick={() => setConfirm(true)}>
          <Ban size={14} /> Block {name}
        </button>
      )}
    </div>
  );
}
