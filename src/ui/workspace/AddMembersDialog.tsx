import { Check, Search, UserPlus, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import type { Member } from "../../api/schemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { searchPeople } from "../../sync/account";
import { type AddOutcome, addMembers, MAX_ADD } from "../../sync/addMembers";
import { UserAvatar } from "../components/OrgAvatar";
import { Dialog } from "../components/Overlay";
import { ApiError } from "../../api/client";
import { QuickInvite } from "./InviteLink";

interface AddMembersDialogProps {
  orgId: string;
  orgName: string;
  onClose: () => void;
  onAdded: () => void;
}

/**
 * Invite people (community-first brief §F, the reference's "Invite friends to …"): find people, pick up to twenty, add
 * them; or make an invitation link with an expiry and a use limit, and copy or share it. The server decides who can be
 * added directly (people you know who'd accept a message from you); anyone else gets the link instead. Search shows only
 * who the server's privacy rules let you find.
 */
export function AddMembersDialog({ orgId, orgName, onClose, onAdded }: AddMembersDialogProps) {
  const engine = useEngine();
  const me = useOrbit((s) => s.me?.userId ?? "");
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Member[] | null>(null);
  const [picked, setPicked] = useState<Member[]>([]);
  const [results, setResults] = useState<Record<string, AddOutcome> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      setFound((await searchPeople(engine, q)).filter((m) => m.id !== me));
    } catch (err) {
      setError(errorText(err, "Couldn't search right now."));
    } finally {
      setBusy(false);
    }
  };
  const toggle = (m: Member) => setPicked((p) => (p.some((x) => x.id === m.id) ? p.filter((x) => x.id !== m.id) : p.length >= MAX_ADD ? p : [...p, m]));
  const add = async () => {
    setError(null);
    setBusy(true);
    try {
      const r = await addMembers(
        engine,
        orgId,
        picked.map((m) => m.id),
      );
      setResults(Object.fromEntries(r.map((x) => [x.userId, x.outcome])));
      if (r.some((x) => x.outcome === "added")) onAdded();
    } catch (err) {
      setError(errorText(err, "Couldn't add them. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const refused = results ? picked.filter((m) => results[m.id] === "not_available") : [];
  return (
    <Dialog
      title={`Invite people to ${orgName}`}
      onClose={onClose}
      footer={
        results ? (
          <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
            <button className="btn btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={busy || picked.length === 0} onClick={() => void add()}>
              <UserPlus size={16} /> {busy ? "Adding…" : picked.length > 1 ? `Add ${picked.length} people` : "Add"}
            </button>
          </div>
        )
      }
    >
      <div className="dialog-body" style={{ display: "grid", gap: 12 }}>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        {results ? (
          <ul className="ws-list" aria-label="Results">
            {picked.map((m) => (
              <li key={m.id} className="row" style={{ gap: 10 }}>
                <UserAvatar userId={m.id} name={m.displayName} colorIndex={m.avatarColor} photoRev={m.photoRev} size={32} decorative />
                <span className="grow ellipsis">{m.displayName}</span>
                <span className={results[m.id] === "added" ? "tag ok" : "faint"}>{OUTCOME_TEXT[results[m.id] ?? "not_available"]}</span>
              </li>
            ))}
            {refused.length > 0 && (
              <li className="invite-or">
                <p className="muted">For anyone who can't be added directly, send an invitation link:</p>
                <QuickInvite orgId={orgId} />
              </li>
            )}
          </ul>
        ) : (
          <>
            <p className="muted" style={{ margin: 0 }}>
              You can add people you know who accept messages from you. Others get an invite link instead.
            </p>
            <form className="row input" style={{ padding: "0 12px" }} onSubmit={(e) => void search(e)}>
              <Search size={16} className="faint" aria-hidden="true" />
              <input
                data-autofocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Name or @username"
                aria-label="Search people to add"
                style={{ border: 0, outline: "none", background: "transparent", flex: 1, padding: "10px 0" }}
              />
              <button className="btn btn-secondary btn-sm" disabled={busy || !q.trim()}>
                Search
              </button>
            </form>
            {picked.length > 0 && (
              <div className="row" style={{ flexWrap: "wrap", gap: 6 }} aria-label="Chosen">
                {picked.map((m) => (
                  <button key={m.id} className="chip" onClick={() => toggle(m)} aria-label={`Remove ${m.displayName}`}>
                    {m.displayName} <X size={12} aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
            {found !== null && found.length === 0 && <p className="faint">No one found. Try their exact @username.</p>}
            {found && found.length > 0 && (
              <ul className="ws-list" aria-label="People found" aria-busy={busy}>
                {found.map((m) => {
                  const on = picked.some((x) => x.id === m.id);
                  return (
                    <li key={m.id}>
                      <button className="row add-person" aria-pressed={on} onClick={() => toggle(m)} disabled={!on && picked.length >= MAX_ADD}>
                        <UserAvatar userId={m.id} name={m.displayName} colorIndex={m.avatarColor} photoRev={m.photoRev} size={32} decorative />
                        <span className="grow ellipsis" style={{ textAlign: "start" }}>
                          {m.displayName} <span className="faint">@{m.username}</span>
                        </span>
                        {on && <Check size={16} aria-hidden="true" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="invite-or" role="group" aria-labelledby="invite-or-title">
              <h3 id="invite-or-title" className="invite-or-title">
                Or send an invitation link
              </h3>
              <QuickInvite orgId={orgId} />
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}

const errorText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

const OUTCOME_TEXT: Record<AddOutcome, string> = {
  added: "Added",
  already_member: "Already a member",
  not_available: "Can't be added directly: send an invite",
};
