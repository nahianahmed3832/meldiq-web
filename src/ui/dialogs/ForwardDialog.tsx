import { Forward, Hash, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { shallowEqual, useEngine, useOrbit } from "../../application/orbit";
import type { StoredMessage } from "../../model/types";
import { forwardMessage } from "../../sync/forward";
import { Avatar, colorIndexOf } from "../components/Avatar";
import { Dialog } from "../components/Overlay";
import { conversationTitle } from "../format";

/** Picks where to forward a message (android message menu › Forward → choose a chat → confirm). */
export function ForwardDialog({ message, onClose }: { message: StoredMessage; onClose: () => void }) {
  const engine = useEngine();
  const [q, setQ] = useState("");
  const [to, setTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const targets = useOrbit(
    (s) =>
      Object.values(s.conversations)
        .filter((c) => c.canPost && !c.archived)
        .map((c) => ({ id: c.id, type: c.type, title: s.me ? conversationTitle(c, s.me.userId, s.users) : "", at: s.local[c.id]?.lastActivityAt ?? c.createdAt }))
        .sort((a, b) => b.at - a.at),
    (a, b) => a.length === b.length && a.every((x, i) => shallowEqual(x, b[i])),
  );
  const shown = useMemo(() => targets.filter((t) => t.title.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 40), [targets, q]);
  const chosen = targets.find((t) => t.id === to);
  const send = async () => {
    if (!to) return;
    setBusy(true);
    setError(null);
    try {
      await forwardMessage(engine, message, to);
      engine.notice("info", `Forwarded to ${chosen?.type === "CHANNEL" ? "#" : ""}${chosen?.title ?? "the conversation"}.`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't forward.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title="Forward to…" onClose={onClose}>
      <div className="dialog-body">
        <div className="row input" style={{ padding: "0 12px" }}>
          <Search size={16} className="faint" />
          <input
            data-autofocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a conversation"
            aria-label="Find a conversation"
            style={{ border: 0, outline: "none", background: "transparent", flex: 1, padding: "10px 0" }}
          />
        </div>
        <div role="listbox" aria-label="Conversations" style={{ display: "grid", gap: 2, maxHeight: 280, overflow: "auto" }}>
          {shown.map((t) => (
            <button key={t.id} role="option" aria-selected={t.id === to} className="list-row" aria-pressed={t.id === to} onClick={() => setTo(t.id)}>
              {t.type === "CHANNEL" ? (
                <span className="empty-orb" style={{ width: 30, height: 30 }}>
                  <Hash size={14} />
                </span>
              ) : (
                <Avatar name={t.title} colorIndex={colorIndexOf(t.id)} size={30} decorative />
              )}
              <span className="grow ellipsis">{t.title}</span>
            </button>
          ))}
        </div>
        <p className="faint" style={{ margin: 0, fontSize: 12.5 }}>
          Sent as a new message marked "Forwarded". The original sender isn't named; files are encrypted again for the new conversation.
        </p>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!to || busy} onClick={() => void send()}>
            <Forward size={16} /> {busy ? "Forwarding…" : "Forward"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
