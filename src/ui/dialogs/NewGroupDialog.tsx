import { Check, Search, UsersRound, X } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { ApiError } from "../../api/client";
import type { Member } from "../../api/schemas";
import { useEngine } from "../../application/orbit";
import { navigate } from "../../application/router";
import { searchPeople } from "../../sync/account";
import { createGroup } from "../../sync/workspaces";
import { Avatar } from "../components/Avatar";
import { Dialog } from "../components/Overlay";

/** Groups hold up to 50 people on this server (server/src/routes/conversations.ts MAX_GROUP); people on other servers can't be added. */
const MAX_OTHERS = 49;

/** A new group conversation: a name and the people in it (android NewActions › New group); [initial] starts picked (B14 "New group with…"). */
export function NewGroupDialog({ onClose, initial = [] }: { onClose: () => void; initial?: Member[] }) {
  const engine = useEngine();
  const [name, setName] = useState("");
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Member[]>([]);
  const [picked, setPicked] = useState<Member[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (!term) return setFound([]);
    const t = setTimeout(() => {
      searchPeople(engine, term)
        .then((r) => setFound(r.filter((m) => m.id !== engine.device.userId && !m.homeServer)))
        .catch(() => setFound([]));
    }, 220);
    return () => clearTimeout(t);
  }, [q, engine]);

  const toggle = (m: Member) => setPicked((p) => (p.some((x) => x.id === m.id) ? p.filter((x) => x.id !== m.id) : p.length >= MAX_OTHERS ? p : [...p, m]));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Give the group a name.");
    if (picked.length === 0) return setError("Add at least one person.");
    setBusy(true);
    setError(null);
    try {
      const c = await createGroup(
        engine,
        name,
        picked.map((m) => m.id),
      );
      onClose();
      navigate({ section: "dms", conversationId: c.id });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create the group.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title="New group" onClose={onClose}>
      <form className="dialog-body" onSubmit={(e) => void submit(e)} noValidate>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <div className="field">
          <label htmlFor="ng-name">Group name</label>
          <input id="ng-name" className="input" data-autofocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </div>
        {picked.length > 0 && (
          <div className="chips" aria-label="People in the group">
            {picked.map((m) => (
              <button type="button" key={m.id} className="chip" onClick={() => toggle(m)} aria-label={`Remove ${m.displayName}`}>
                {m.displayName} <X size={12} />
              </button>
            ))}
          </div>
        )}
        <div className="row input" style={{ padding: "0 12px" }}>
          <Search size={16} className="faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Add people by name or @username"
            aria-label="Find people"
            style={{ border: 0, outline: "none", background: "transparent", flex: 1, padding: "10px 0" }}
          />
        </div>
        <div aria-label="People found" style={{ display: "grid", gap: 2, maxHeight: 240, overflow: "auto" }}>
          {found.map((p) => {
            const on = picked.some((x) => x.id === p.id);
            return (
              <button type="button" key={p.id} className="list-row" aria-pressed={on} onClick={() => toggle(p)}>
                <Avatar name={p.displayName} colorIndex={p.avatarColor} size={32} decorative />
                <span className="lines grow">
                  <span className="ellipsis">{p.displayName}</span>
                  <small>@{p.username}</small>
                </span>
                {on && <Check size={16} />}
              </button>
            );
          })}
        </div>
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            <UsersRound size={16} /> {busy ? "Creating…" : `Create group${picked.length ? ` (${picked.length + 1})` : ""}`}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
