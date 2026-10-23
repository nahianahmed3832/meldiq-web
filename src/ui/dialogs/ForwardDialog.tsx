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
import { useT } from "../../i18n";

/**
 * Forward To (android, 2026-10-23): up to five conversations at once, a preview of what goes, an optional message sent
 * after it, and Copy link (people in the original conversation can open it).
 */
export function ForwardDialog({ message, onClose }: { message: StoredMessage; onClose: () => void }) {
  const engine = useEngine();
  const t = useT();
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
    const target = targets.find((x) => x.id === id);
    return target ? `${target.type === "CHANNEL" ? "#" : ""}${target.title}` : t("fwd_the_conversation");
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
        done.length === 1 ? t("fwd_done_one", { name: name(done[0].conversationId) }) : missed ? t("fwd_done_some", { n: done.length, missed }) : t("fwd_done_n", { n: done.length }),
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("fwd_failed"));
    } finally {
      setBusy(false);
    }
  };
  const copyLink = () => {
    void navigator.clipboard?.writeText(messageLink(message.conversationId, message.id)).catch(() => undefined);
    engine.notice("info", t("msg_link_copied"));
  };
  const files = message.attachments.length;
  return (
    <Dialog title={t("fwd_title")} onClose={onClose}>
      <div className="dialog-body">
        <div className="forward-preview" aria-label={t("fwd_what")}>
          <Forward size={14} aria-hidden="true" />
          <span className="grow clamp-2">{message.text || (files ? "" : t("fwd_message"))}</span>
          {files > 0 && (
            <span className="faint row" style={{ gap: 4 }}>
              <Paperclip size={13} aria-hidden="true" /> {t(files === 1 ? "fwd_file" : "fwd_files", { n: files })}
            </span>
          )}
        </div>
        <div className="row input" style={{ padding: "0 12px" }}>
          <Search size={16} className="faint" />
          <input
            data-autofocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("fwd_find")}
            aria-label={t("fwd_find")}
            style={{ border: 0, outline: "none", background: "transparent", flex: 1, padding: "10px 0" }}
          />
        </div>
        <small className="faint">{full ? t("fwd_full", { n: MAX_FORWARD_TARGETS }) : t("fwd_choose", { n: MAX_FORWARD_TARGETS })}</small>
        <div role="listbox" aria-multiselectable="true" aria-label={t("fwd_conversations")} style={{ display: "grid", gap: 2, maxHeight: 260, overflow: "auto" }}>
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
        <textarea className="input" rows={2} maxLength={MAX_FORWARD_NOTE} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("fwd_note_placeholder")} aria-label={t("fwd_note")} />
        <p className="faint" style={{ margin: 0, fontSize: 12.5 }}>
          {t("fwd_explain")}
        </p>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <div className="row" style={{ gap: 8 }}>
          {canLink(message.deleted, message.status) && (
            <button className="btn btn-ghost" onClick={copyLink}>
              <Link2 size={16} /> {t("fwd_copy_link")}
            </button>
          )}
          <span className="grow" />
          <button className="btn btn-secondary" onClick={onClose}>
            {t("common_cancel")}
          </button>
          <button className="btn btn-primary" disabled={!to.length || busy} onClick={() => void send()}>
            <Forward size={16} /> {busy ? t("fwd_busy") : to.length > 1 ? t("fwd_to_n", { n: to.length }) : t("msg_forward")}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
