import { Blocks } from "lucide-react";
import { useState } from "react";
import { useEngine, useOrbit } from "../../app/orbit";
import { isWebUrl } from "../../protocol/payload";
import { channelAppEvents } from "../../sync/apps";
import { Dialog } from "../components/Overlay";
import { relative } from "../format";
import { useLoad } from "../workspace/useLoad";
import { SafeLink } from "./SafeLink";

/**
 * App updates in a channel (android AppUpdates.kt): what connected apps and incoming webhooks posted here. They're kept by
 * the server and readable by the channel's members, so they're labelled as not end-to-end encrypted.
 */
export function AppUpdatesBar({ conversationId }: { conversationId: string }) {
  const engine = useEngine();
  const available = useOrbit((s) => s.server?.features.includes("integrations") ?? false);
  const rev = useOrbit((s) => s.appEventsRev[conversationId] ?? 0);
  const events = useLoad(() => (available ? channelAppEvents(engine, conversationId) : Promise.resolve([])), [engine, conversationId, available, rev]);
  const [open, setOpen] = useState(false);
  const list = events.data ?? [];
  if (!list.length) return null;
  const latest = list.reduce((a, b) => (b.createdAt > a.createdAt ? b : a));
  return (
    <div className="conv-banners">
      <button className="banner info app-updates" onClick={() => setOpen(true)}>
        <Blocks size={16} />
        <span className="grow ellipsis">
          {list.length} app {list.length === 1 ? "update" : "updates"} · {latest.appName}: {latest.title}
        </span>
        <span className="faint">{relative(latest.createdAt)}</span>
      </button>
      {open && (
        <Dialog title="App updates" onClose={() => setOpen(false)}>
          <div className="dialog-body">
            <div className="banner warn">Posted by apps and webhooks. Unlike messages, these aren't end-to-end encrypted: the server keeps them for 30 days.</div>
            <ul className="ws-list">
              {[...list]
                .sort((a, b) => b.createdAt - a.createdAt)
                .map((e) => (
                  <li key={e.id} className="ws-row" style={{ alignItems: "flex-start" }}>
                    <span className="lines grow">
                      <span>
                        <strong>{e.appName}</strong> · {e.url && isWebUrl(e.url) ? <SafeLink href={e.url}>{e.title}</SafeLink> : e.title}
                      </span>
                      {e.summary && <small>{e.summary}</small>}
                      <small>
                        {e.actor ? `${e.actor} · ` : ""}
                        {relative(e.occurredAt ?? e.createdAt)}
                      </small>
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        </Dialog>
      )}
    </div>
  );
}
