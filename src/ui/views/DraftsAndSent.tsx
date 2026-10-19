import { PenLine, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { shallowEqual, useEngine, useOrbit } from "../../app/orbit";
import { navigate } from "../../app/router";
import type { StoredMessage } from "../../model/types";
import { conversationTitle, shortWhen } from "../format";
import { inWorkspace } from "../selectors";

const SENT_SHOWN = 5;

/**
 * Home › Drafts & sent (android WorkspaceHomeRules.drafts, MessageDao.observeRecentSent): conversations with an unsent
 * draft, and your latest sent messages, to pick up where you left off. Both come from this browser only.
 */
export function DraftsAndSent({ orgId }: { orgId: string | null }) {
  const engine = useEngine();
  const drafts = useOrbit(
    (s) =>
      Object.values(s.conversations)
        .filter((c) => inWorkspace(c, orgId) && (s.local[c.id]?.draft ?? "").trim())
        .map((c) => ({ id: c.id, type: c.type, title: s.me ? conversationTitle(c, s.me.userId, s.users) : "", draft: s.local[c.id]!.draft })),
    (a, b) => a.length === b.length && a.every((x, i) => shallowEqual(x, b[i])),
  );
  const conversations = useOrbit((s) => s.conversations);
  const users = useOrbit((s) => s.users);
  const me = useOrbit((s) => s.me);
  const lastSent = useOrbit((s) => Math.max(0, ...Object.values(s.local).map((l) => l.lastActivityAt)));
  const [sent, setSent] = useState<StoredMessage[]>([]);
  useEffect(() => {
    let alive = true;
    engine
      .recentSent(SENT_SHOWN * 3)
      .then((list) => alive && setSent(list))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [engine, lastSent]);
  const shownSent = sent.filter((m) => conversations[m.conversationId] && inWorkspace(conversations[m.conversationId], orgId)).slice(0, SENT_SHOWN);
  if (drafts.length === 0 && shownSent.length === 0) return null;
  const open = (id: string, type: string) => navigate({ section: type === "CHANNEL" ? "home" : "dms", conversationId: id });
  const title = (id: string) => {
    const c = conversations[id];
    return c && me ? conversationTitle(c, me.userId, users) : "";
  };
  return (
    <div className="card list-card" aria-label="Drafts and sent">
      <h2>Drafts &amp; sent</h2>
      {drafts.map((d) => (
        <button key={`d:${d.id}`} className="list-row" onClick={() => open(d.id, d.type)}>
          <span className="empty-orb" style={{ width: 36, height: 36 }}>
            <PenLine size={16} />
          </span>
          <span className="lines">
            <span className="ellipsis" style={{ fontWeight: 700 }}>
              {d.type === "CHANNEL" ? `#${d.title}` : d.title}
            </span>
            <small className="ellipsis">Draft: {d.draft}</small>
          </span>
        </button>
      ))}
      {shownSent.map((m) => {
        const c = conversations[m.conversationId]!;
        return (
          <button key={`s:${m.id}`} className="list-row" onClick={() => open(c.id, c.type)}>
            <span className="empty-orb" style={{ width: 36, height: 36 }}>
              <Send size={15} />
            </span>
            <span className="lines">
              <span className="ellipsis" style={{ fontWeight: 700 }}>
                {c.type === "CHANNEL" ? `#${title(c.id)}` : title(c.id)}
              </span>
              <small className="ellipsis">You: {m.text}</small>
            </span>
            <span className="faint" style={{ fontSize: 12 }}>
              {shortWhen(m.sortTs)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
