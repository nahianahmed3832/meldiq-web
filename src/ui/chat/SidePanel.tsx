import { BellOff, Fingerprint, Hash, Lock, MessageSquare, Pin, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Member } from "../../api/schemas";
import { useEngine, useOrbit } from "../../app/orbit";
import { navigate, type Route } from "../../app/router";
import { safetyNumber } from "../../crypto/identity";
import type { StoredMessage } from "../../model/types";
import { conversationMembers, startDirect, userProfile } from "../../sync/account";
import { Avatar } from "../components/Avatar";
import { conversationTitle, dmPeer, dayLabel } from "../format";
import { preview } from "../../sync/rules";
import { Composer } from "./Composer";
import { MessageList } from "./MessageList";

export function SidePanel({ route }: { route: Route }) {
  const close = () => navigate({ section: route.section, conversationId: route.conversationId });
  if (!route.conversationId) return null;
  return route.panel === "thread" && route.threadRoot ? (
    <ThreadPanel conversationId={route.conversationId} root={route.threadRoot} onClose={close} />
  ) : (
    <DetailsPanel conversationId={route.conversationId} onClose={close} />
  );
}

function PanelHead({ title, sub, onClose }: { title: string; sub?: string; onClose: () => void }) {
  return (
    <div className="panel-head">
      <div className="grow" style={{ minWidth: 0 }}>
        <h2>{title}</h2>
        {sub && <small className="ellipsis">{sub}</small>}
      </div>
      <button className="icon-btn" onClick={onClose} aria-label="Close panel">
        <X size={18} />
      </button>
    </div>
  );
}

function DetailsPanel({ conversationId, onClose }: { conversationId: string; onClose: () => void }) {
  const engine = useEngine();
  const c = useOrbit((s) => s.conversations[conversationId]);
  const me = useOrbit((s) => s.me);
  const users = useOrbit((s) => s.users);
  const loaded = useOrbit((s) => s.messages[conversationId]?.items);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [safety, setSafety] = useState<string | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);
  const peer = c && me && c.type === "DM" ? dmPeer(c, me.userId) : null;

  useEffect(() => {
    setMembers(null);
    conversationMembers(engine, conversationId)
      .then(setMembers)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't load members"));
  }, [engine, conversationId]);

  useEffect(() => {
    if (!peer || !me) return;
    let alive = true;
    void (async () => {
      const pin = await engine.pinnedIdentity(peer.id);
      const key = pin?.identityKey ?? (await userProfile(engine, peer.id)).identityKey;
      if (!alive) return;
      setSafety(await safetyNumber(me.identityKey, key));
      setVerified(pin?.verified ?? false);
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [engine, peer, me]);

  if (!c || !me) return null;
  const title = conversationTitle(c, me.userId, users);
  const pinned = (loaded ?? []).filter((m) => m.pinned && !m.deleted);
  const files = (loaded ?? [])
    .flatMap((m) => m.attachments.map((a) => ({ a, m })))
    .slice(-8)
    .reverse();

  return (
    <aside className="panel" aria-label="Details">
      <PanelHead title="Details" sub={c.type === "CHANNEL" ? `#${title}` : title} onClose={onClose} />
      <div className="panel-body scroll">
        <div className="panel-card">
          <dl style={{ margin: 0 }}>
            {c.type === "CHANNEL" && (
              <div>
                <dt>Topic</dt>
                <dd>{c.topic ?? <span className="faint">No topic</span>}</dd>
              </div>
            )}
            <div>
              <dt>Type</dt>
              <dd className="row" style={{ gap: 6 }}>
                {c.type === "CHANNEL" ? c.kind === "PRIVATE" ? <Lock size={14} /> : <Hash size={14} /> : <MessageSquare size={14} />}
                {c.type === "CHANNEL"
                  ? `${c.kind === "PRIVATE" ? "Private" : c.kind === "ANNOUNCEMENT" ? "Announcement" : "Public"} channel${c.scopeName ? ` in ${c.scopeName}` : ""}`
                  : c.type === "GROUP"
                    ? "Group"
                    : "Direct message"}
              </dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{dayLabel(c.createdAt)}</dd>
            </div>
            <div>
              <dt>Encryption</dt>
              <dd className="row" style={{ gap: 6 }}>
                <ShieldCheck size={14} /> End-to-end encrypted on your devices
              </dd>
            </div>
          </dl>
        </div>

        {peer && safety && (
          <div className="panel-card">
            <div style={{ display: "grid", gap: 8 }}>
              <div className="panel-section-title">
                <span className="row" style={{ gap: 6 }}>
                  <Fingerprint size={14} /> Safety number
                </span>
                {verified ? <span className="tag ok">Verified</span> : <span className="tag">Not verified</span>}
              </div>
              <span className="fingerprint" style={{ fontSize: 13, whiteSpace: "pre-line" }}>
                {safety}
              </span>
              <span className="faint" style={{ fontSize: 12 }}>
                Compare it with {peer.displayName} in person or on a call. If it matches on both screens, nobody is in between.
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  void engine.markVerified(peer.id, !verified).then(() => setVerified(!verified));
                }}
              >
                {verified ? "Clear verified" : "Mark as verified"}
              </button>
            </div>
          </div>
        )}

        {pinned.length > 0 && (
          <div style={{ display: "grid", gap: 6 }}>
            <div className="panel-section-title">
              <span className="row" style={{ gap: 6 }}>
                <Pin size={13} /> Pinned
              </span>
              <span>{pinned.length}</span>
            </div>
            {pinned.map((m) => (
              <button key={m.id} className="msg-quote" style={{ maxWidth: "none" }} onClick={() => document.getElementById(`msg-${m.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" })}>
                <strong>{m.outgoing ? "You" : (users[m.senderUserId]?.displayName ?? "Unknown")}</strong>
                <span className="ellipsis">{preview(m)}</span>
              </button>
            ))}
          </div>
        )}

        {c.type !== "DM" && (
          <div style={{ display: "grid", gap: 4 }}>
            <div className="panel-section-title">
              <span>Members</span>
              <span>{c.memberCount}</span>
            </div>
            {error && <div className="banner danger">{error}</div>}
            {!members && !error && <span className="skeleton" style={{ height: 120 }} />}
            {members?.map((m) => (
              <div key={m.id} className="person">
                <Avatar name={m.displayName} colorIndex={m.avatarColor} size={32} online={m.online} decorative />
                <div className="lines grow">
                  <span className="ellipsis">
                    {m.displayName}
                    {m.id === me.userId ? " (you)" : ""}
                  </span>
                  <small className="ellipsis">
                    @{m.username}
                    {m.role === "ADMIN" ? " · admin" : ""}
                    {m.orgRole && m.orgRole !== "MEMBER" ? ` · ${m.orgRole.toLowerCase()}` : ""}
                  </small>
                </div>
                {m.id !== me.userId && (
                  <button
                    className="icon-btn"
                    aria-label={`Message ${m.displayName}`}
                    onClick={() => {
                      void startDirect(engine, m.id)
                        .then((cid) => navigate({ section: "dms", conversationId: cid }))
                        .catch((e: unknown) => engine.notice("error", e instanceof Error ? e.message : "Couldn't open the conversation"));
                    }}
                  >
                    <MessageSquare size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {files.length > 0 && (
          <div style={{ display: "grid", gap: 6 }}>
            <div className="panel-section-title">
              <span>Recent files</span>
            </div>
            {files.map(({ a, m }) => (
              <div key={a.id} className="person">
                <span className="file-icon" style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", background: "var(--accent-soft)", color: "var(--accent-text)" }}>
                  <MessageSquare size={14} />
                </span>
                <div className="lines grow">
                  <span className="ellipsis">{a.name}</span>
                  <small>{dayLabel(m.sortTs)}</small>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="faint" style={{ fontSize: 12, margin: 0, display: "flex", gap: 6 }}>
          <BellOff size={14} /> Muting and other chat preferences are set on your phone.
        </p>
      </div>
    </aside>
  );
}

function ThreadPanel({ conversationId, root, onClose }: { conversationId: string; root: string; onClose: () => void }) {
  const c = useOrbit((s) => s.conversations[conversationId]);
  const items = useOrbit((s) => s.messages[conversationId]?.items);
  const me = useOrbit((s) => s.me);
  const users = useOrbit((s) => s.users);
  const rootMsg: StoredMessage | undefined = items?.find((m) => m.id === root);
  if (!c || !me) return null;
  const title = conversationTitle(c, me.userId, users);
  return (
    <aside className="panel" aria-label="Thread">
      <PanelHead title="Thread" sub={c.type === "CHANNEL" ? `#${title}` : title} onClose={onClose} />
      {rootMsg ? (
        <>
          <MessageList
            conversationId={conversationId}
            items={items ?? []}
            hasMore={false}
            onLoadOlder={() => undefined}
            threadRoot={root}
            canPost={c.canPost}
            onReply={() => undefined}
            onThread={null}
            onReview={() => undefined}
          />
          <Composer conversation={c} title={title} replyTo={null} replyName={null} onCancelReply={() => undefined} threadRoot={root} dropped={[]} onDroppedTaken={() => undefined} />
        </>
      ) : (
        <div className="empty">
          <p>This thread's first message isn't on this browser yet.</p>
        </div>
      )}
    </aside>
  );
}
