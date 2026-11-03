import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { BellOff, LogOut } from "lucide-react";
import { useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate } from "../../application/router";
import { levelOf, type NotifyLevel, workspaceOf } from "../../sync/navPrefs";
import { removeConversationMember } from "../../sync/workspaces";
const LEVELS: {
  level: NotifyLevel;
  label: string;
}[] = [
  {
    level: "all",
    get label() {
      return uiText("messaging.interface.all_new_messages_0bd334d");
    },
  },
  {
    level: "mentions",
    get label() {
      return uiText("messaging.interface.mentions_only_78732e1");
    },
  },
  {
    level: "none",
    get label() {
      return uiText("messaging.interface.off_ca7981b");
    },
  },
];
/** Notifications (synced to every device of the person) and leaving a group. */
export function ConversationSettings({ conversationId }: { conversationId: string }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const c = useOrbit((s) => s.conversations[conversationId]);
  const level = useOrbit((s) => levelOf(s.nav[workspaceOf(c?.orgId ?? null)], conversationId, c?.categoryId ?? null));
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!c) return null;
  // People leave a community, not one of its channels (as on Android, batch B14b); a group can still be left.
  const leavable = c.type === "GROUP";
  const leave = async () => {
    try {
      await removeConversationMember(engine, conversationId, engine.device.userId);
      await engine.refreshAll();
      navigate({ section: "dms" });
    } catch (e) {
      setError(e instanceof Error ? e.message : uiText("messaging.interface.couldn_t_leave_33e0efa"));
    }
  };
  return (
    <div className="panel-card" style={{ display: "grid", gap: 10 }}>
      <label className="field">
        <span className="panel-section-title">
          <span className="row" style={{ gap: 6 }}>
            <BellOff size={14} /> {l10n("settings.notifications")}
          </span>
        </span>
        <select className="input input-sm" value={level} onChange={(e) => void engine.arrange(conversationId, { op: "notify", conversationId, level: e.target.value as NotifyLevel })}>
          {LEVELS.map((l) => (
            <option key={l.level} value={l.level}>
              {l.label}
            </option>
          ))}
        </select>
        <span className="hint">
          <Localized k="messaging.interface.applies_on_all_your_devices_a_mention_of_you_still_notifies_when_3cfafd7" />
        </span>
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
              <span className="grow">
                <Localized k="messaging.interface.leave_this_group_4ed01b5" />
              </span>
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirm(false)}>
                {l10n("common.actions.cancel")}
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => void leave()}>
                <Localized k="messaging.interface.leave_fc6e4a4" />
              </button>
            </div>
          ) : (
            <button className="btn btn-danger-quiet btn-sm" style={{ justifySelf: "start" }} onClick={() => setConfirm(true)}>
              <Localized k="messaging.interface.leave_group_4c26a32" slots={[<LogOut size={14} />]} />
            </button>
          )}
        </>
      )}
    </div>
  );
}
