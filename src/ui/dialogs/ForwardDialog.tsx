import { Check, Forward, Hash, Link2, Paperclip, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { shallowEqual, useEngine, useOrbit } from "../../application/orbit";
import type { StoredMessage } from "../../model/types";
import { forwardMessage, MAX_FORWARD_NOTE, MAX_FORWARD_TARGETS } from "../../sync/forward";
import { canLink, messageLink } from "../../sync/messageLinks";
import { colorIndexOf } from "../components/Avatar";
import { GroupAvatar, UserAvatar } from "../components/OrgAvatar";
import { Dialog } from "../components/Overlay";
import { conversationTitle, dmPeer } from "../format";

/**
 * Forward To (android, 2026-10-23): up to five conversations at once, a preview of what goes, an optional message sent
 * after it, and Copy link (people in the original conversation can open it).
 */
export function ForwardDialog({ message, onClose }: { message: StoredMessage; onClose: () => void }) {
  const engine = useEngine();
  const [q, setQ] = useState("");
  const [to, setTo] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const targets = useOrbit(
    (s) =>
      Object.values(s.conversations)
        .filter((c) => c.canPost && !c.archived)
        .map((c) => {
          const peer = c.type === "DM" && s.me ? dmPeer(c, s.me.userId) : null;
          return {
            id: c.id,
            type: c.type,
            title: s.me ? conversationTitle(c, s.me.userId, s.users) : "",
            at: s.local[c.id]?.lastActivityAt ?? c.createdAt,
            peerId: peer?.id ?? null,
            color: peer?.avatarColor ?? colorIndexOf(c.id),
            photoRev: peer ? (s.users[peer.id]?.photoRev ?? null) : (c.photoRev ?? null),
          };
        })
        .sort((a, b) => b.at - a.at),
    (a, b) => a.length === b.length && a.every((x, i) => shallowEqual(x, b[i])),
  );
  const shown = useMemo(() => targets.filter((t) => t.title.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 40), [targets, q]);
  const full = to.length >= MAX_FORWARD_TARGETS;
  const toggle = (id: string) => setTo((list) => (list.includes(id) ? list.filter((x) => x !== id) : list.length < MAX_FORWARD_TARGETS ? [...list, id] : list));
  const name = (id: string) => {
    const t = targets.find((x) => x.id === id);
    return t ? `${t.type === "CHANNEL" ? "#" : ""}${t.title}` : "the conversation";
  };
  const send = async () => {
    if (!to.length) return;
    setBusy(true);
    setError(null);
    try {
      const done = await forwardMessage(engine, message, to, note);
      const missed = to.length - done.length;
      engine.notice(
        missed ? "error" : "info",
        done.length === 1 ? `Forwarded to ${name(done[0].conversationId)}.` : `Forwarded to ${done.length} conversations${missed ? `; ${missed} couldn't be reached` : ""}.`,
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't forward.");
    } finally {
      setBusy(false);
    }
  };
  const copyLink = () => {
    void navigator.clipboard?.writeText(messageLink(message.conversationId, message.id)).catch(() => undefined);
    engine.notice("info", "Message link copied. It opens only for people in this conversation.");
  };
  const files = message.attachments.length;
  return (
    <Dialog title="Forward to…" onClose={onClose}>
      <div className="dialog-body">
        <div className="forward-preview" aria-label="What's forwarded">
          <Forward size={14} aria-hidden="true" />
          <span className="grow clamp-2">{message.text || (files ? "" : "Message")}</span>
          {files > 0 && (
            <span className="faint row" style={{ gap: 4 }}>
              <Paperclip size={13} aria-hidden="true" /> {files === 1 ? "1 file" : `${files} files`}
            </span>
          )}
        </div>
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
        <small className="faint">{full ? `You can forward to ${MAX_FORWARD_TARGETS} conversations at once.` : `Choose up to ${MAX_FORWARD_TARGETS}.`}</small>
        <div role="listbox" aria-multiselectable="true" aria-label="Conversations" style={{ display: "grid", gap: 2, maxHeight: 260, overflow: "auto" }}>
          {shown.map((t) => {
            const on = to.includes(t.id);
            return (
              <button key={t.id} role="option" aria-selected={on} className="list-row" disabled={!on && full} onClick={() => toggle(t.id)}>
                {t.type === "CHANNEL" ? (
                  <span className="empty-orb" style={{ width: 30, height: 30 }}>
                    <Hash size={14} />
                  </span>
                ) : t.peerId ? (
                  <UserAvatar userId={t.peerId} name={t.title} colorIndex={t.color} photoRev={t.photoRev} size={30} decorative />
                ) : (
                  <GroupAvatar conversationId={t.id} name={t.title} photoRev={t.photoRev} size={30} />
                )}
                <span className="grow ellipsis">{t.title}</span>
                <span className={`forward-check${on ? " on" : ""}`} aria-hidden="true">
                  {on && <Check size={13} />}
                </span>
              </button>
            );
          })}
        </div>
        <textarea className="input" rows={2} maxLength={MAX_FORWARD_NOTE} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a message (optional)" aria-label="Add a message" />
        <p className="faint" style={{ margin: 0, fontSize: 12.5 }}>
          Sent as a new message marked "Forwarded". The original sender isn't named; files are encrypted again for each conversation.
        </p>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <div className="row" style={{ gap: 8 }}>
          {canLink(message.deleted, message.status) && (
            <button className="btn btn-ghost" onClick={copyLink}>
              <Link2 size={16} /> Copy link
            </button>
          )}
          <span className="grow" />
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!to.length || busy} onClick={() => void send()}>
            <Forward size={16} /> {busy ? "Forwarding…" : to.length > 1 ? `Forward to ${to.length}` : "Forward"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
