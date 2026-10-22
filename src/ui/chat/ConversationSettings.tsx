import { BellOff, LogOut } from "lucide-react";
import { useState } from "react";
import { useEngine, useOrbit } from "../../app/orbit";
import { navigate } from "../../app/router";
import { levelOf, type NotifyLevel, workspaceOf } from "../../sync/navPrefs";
import { removeConversationMember } from "../../sync/workspaces";

const LEVELS: { level: NotifyLevel; label: string }[] = [
  { level: "all", label: "All new messages" },
  { level: "mentions", label: "Mentions only" },
  { level: "none", label: "Off" },
];

/** Notifications (synced to every device of the person) and leaving the group or channel. */
export function ConversationSettings({ conversationId }: { conversationId: string }) {
  const engine = useEngine();
  const c = useOrbit((s) => s.conversations[conversationId]);
  const level = useOrbit((s) => levelOf(s.nav[workspaceOf(c?.orgId ?? null)], conversationId, c?.categoryId ?? null));
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!c) return null;
  const leavable = c.type === "GROUP" || (c.type === "CHANNEL" && !(c.kind === "ANNOUNCEMENT" && !c.canManage));
  const leave = async () => {
    try {
      await removeConversationMember(engine, conversationId, engine.device.userId);
      await engine.refreshAll();
      navigate({ section: c.type === "CHANNEL" ? "home" : "dms" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't leave.");
    }
  };
  return (
    <div className="panel-card" style={{ display: "grid", gap: 10 }}>
      <label className="field">
        <span className="panel-section-title">
          <span className="row" style={{ gap: 6 }}>
            <BellOff size={14} /> Notifications
          </span>
        </span>
        <select className="input input-sm" value={level} onChange={(e) => void engine.arrange(conversationId, { op: "notify", conversationId, level: e.target.value as NotifyLevel })}>
          {LEVELS.map((l) => (
            <option key={l.level} value={l.level}>
              {l.label}
            </option>
          ))}
        </select>
        <span className="hint">Applies on all your devices. A mention of you still notifies when they're off.</span>
      </label>
      {leavable && (
        <>
          {error && (
            <div className="banner danger" role="alert">
              {error}
            </div>
          )}
          {confirm ? (
            <div className="row" style={{ gap: 8 }}>
              <span className="grow">Leave {c.type === "GROUP" ? "this group" : "this channel"}?</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirm(false)}>
                Cancel
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => void leave()}>
                Leave
              </button>
            </div>
          ) : (
            <button className="btn btn-danger-quiet btn-sm" style={{ justifySelf: "start" }} onClick={() => setConfirm(true)}>
              <LogOut size={14} /> Leave {c.type === "GROUP" ? "group" : "channel"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
