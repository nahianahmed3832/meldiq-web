import { Search, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import type { Member } from "../../api/schemas";
import { useEngine, useOrbit } from "../../app/orbit";
import { navigate } from "../../app/router";
import { resolveAddress, searchPeople, startDirect } from "../../sync/account";
import { lookupKind, normalAddress } from "../../sync/lookup";
import { findByPhone } from "../../sync/profile";
import { Avatar } from "../components/Avatar";
import { Dialog } from "../components/Overlay";

/**
 * Start a direct message: people who share a workspace with you, anyone by exact @username (server search rules), by exact
 * phone number (only people who allow it), or on another server by their full address (@name:domain, when this server
 * federates).
 */
export function NewMessageDialog({ onClose, onNewGroup }: { onClose: () => void; onNewGroup?: () => void }) {
  const engine = useEngine();
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<Member[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const federates = useOrbit((s) => !!s.server?.federation);
  const term = q.trim();
  const kind = lookupKind(term);

  useEffect(() => {
    if (!term) return setPeople([]);
    let alive = true;
    const find = async (): Promise<Member[]> => {
      if (kind === "phone") {
        // The server only looks up international numbers: say so rather than answer "no one found".
        if (!term.startsWith("+")) throw new Error("Phone numbers start with + and the country code, for example +44 20 7946 0000.");
        const p = await findByPhone(engine, term);
        return p ? [p] : [];
      }
      if (kind === "address") return federates ? [await resolveAddress(engine, normalAddress(term))] : [];
      return searchPeople(engine, term);
    };
    const t = setTimeout(() => {
      find()
        .then((r) => {
          if (!alive) return;
          setPeople(r);
          setError(null);
        })
        .catch((e: unknown) => {
          if (!alive) return;
          setPeople([]);
          setError(e instanceof Error ? e.message : "Search failed");
        });
    }, 220);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [term, kind, federates, engine]);

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
            placeholder={federates ? "Name, @username, phone or @name:server" : "Name, @username or phone number"}
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
          {term && people.length === 0 && !error && (
            <p className="faint" style={{ margin: "8px 4px" }}>
              {kind === "phone"
                ? "No one found with that number. People only appear here by phone if they allow it (Settings › Privacy)."
                : kind === "address"
                  ? federates
                    ? "No one found at that address."
                    : "This Meldiq server doesn't connect to other servers, so addresses like @name:server can't be reached."
                  : "No one found. People appear here when you share a workspace, or by their exact @username."}
            </p>
          )}
          {!q.trim() && (
            <>
              <p className="faint" style={{ margin: "8px 4px" }}>
                Search for a colleague, or start a group conversation.
              </p>
              {onNewGroup && (
                <button className="list-row" onClick={onNewGroup}>
                  <span className="empty-orb" style={{ width: 34, height: 34 }}>
                    <UsersRound size={16} />
                  </span>
                  <span className="lines">
                    <span>New group</span>
                    <small>Up to 50 people on this server</small>
                  </span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}
