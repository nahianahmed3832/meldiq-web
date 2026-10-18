import { Hash, Lock, Megaphone } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { Conversation } from "../../api/schemas";
import { useEngine } from "../../app/orbit";
import { navigate } from "../../app/router";
import { browseChannels, joinChannel } from "../../sync/account";
import { Dialog } from "../components/Overlay";

/** Channels the server lets you see in this workspace: open the ones you're in, join public ones in your scope. */
export function ChannelBrowser({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const engine = useEngine();
  const [list, setList] = useState<Conversation[] | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    browseChannels(engine, orgId)
      .then(setList)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't load channels"));
  }, [engine, orgId]);
  useEffect(load, [load]);

  const shown = (list ?? []).filter((c) => !q || (c.name ?? "").toLowerCase().includes(q.toLowerCase()) || (c.topic ?? "").toLowerCase().includes(q.toLowerCase()));

  return (
    <Dialog title="Browse channels" onClose={onClose} wide>
      <div className="dialog-body">
        <input className="input" data-autofocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search channels" aria-label="Search channels" />
        {error && <div className="banner danger">{error}</div>}
        {!list && !error && <span className="skeleton" style={{ height: 160 }} />}
        {list && shown.length === 0 && <p className="faint">No channels match.</p>}
        <div style={{ display: "grid", gap: 2 }}>
          {shown.map((c) => (
            <div key={c.id} className="list-row">
              <span className="empty-orb" style={{ width: 36, height: 36 }}>
                {c.kind === "PRIVATE" ? <Lock size={16} /> : c.kind === "ANNOUNCEMENT" ? <Megaphone size={16} /> : <Hash size={16} />}
              </span>
              <span className="lines">
                <span className="ellipsis" style={{ fontWeight: 600 }}>
                  {c.name}
                  {c.archived ? " · archived" : ""}
                </span>
                <small className="ellipsis">{[c.topic, `${c.memberCount} members`, c.scopeName].filter(Boolean).join(" · ")}</small>
              </span>
              {c.joined ? (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    onClose();
                    navigate({ section: "home", conversationId: c.id });
                  }}
                >
                  Open
                </button>
              ) : c.kind === "PRIVATE" ? (
                <span className="tag">Invite only</span>
              ) : (
                <button
                  className="btn btn-primary btn-sm"
                  disabled={busy === c.id || c.archived}
                  onClick={() => {
                    setBusy(c.id);
                    joinChannel(engine, c.id)
                      .then(() => {
                        onClose();
                        navigate({ section: "home", conversationId: c.id });
                      })
                      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't join"))
                      .finally(() => setBusy(null));
                  }}
                >
                  Join
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
