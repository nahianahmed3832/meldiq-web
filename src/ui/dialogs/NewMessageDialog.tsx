import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import type { Member } from "../../api/schemas";
import { useEngine } from "../../app/orbit";
import { navigate } from "../../app/router";
import { searchPeople, startDirect } from "../../sync/account";
import { Avatar } from "../components/Avatar";
import { Dialog } from "../components/Overlay";

/** Start a direct message: people who share a workspace with you, or anyone by exact @username (server search rules). */
export function NewMessageDialog({ onClose }: { onClose: () => void }) {
  const engine = useEngine();
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<Member[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (!term) return setPeople([]);
    const t = setTimeout(() => {
      searchPeople(engine, term)
        .then((r) => {
          setPeople(r);
          setError(null);
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : "Search failed"));
    }, 220);
    return () => clearTimeout(t);
  }, [q, engine]);

  const open = async (id: string) => {
    setBusy(true);
    try {
      const cid = await startDirect(engine, id);
      onClose();
      navigate({ section: "dms", conversationId: cid });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open the conversation");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title="New message" onClose={onClose}>
      <div className="dialog-body">
        <div className="row input" style={{ padding: "0 12px" }}>
          <Search size={16} className="faint" />
          <input
            data-autofocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name or @username"
            aria-label="Find people"
            style={{ border: 0, outline: "none", background: "transparent", flex: 1, padding: "10px 0" }}
          />
        </div>
        {error && <div className="banner danger">{error}</div>}
        <div aria-label="People" style={{ display: "grid", gap: 2 }}>
          {people.map((p) => (
            <button key={p.id} className="list-row" disabled={busy} onClick={() => void open(p.id)}>
              <Avatar name={p.displayName} colorIndex={p.avatarColor} size={34} online={p.online} decorative />
              <span className="lines">
                <span className="ellipsis">{p.displayName}</span>
                <small>@{p.username}</small>
              </span>
            </button>
          ))}
          {q.trim() && people.length === 0 && !error && (
            <p className="faint" style={{ margin: "8px 4px" }}>
              No one found. People appear here when you share a workspace, or by their exact @username.
            </p>
          )}
          {!q.trim() && (
            <p className="faint" style={{ margin: "8px 4px" }}>
              Search for a colleague. New groups are created on the phone for now.
            </p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
