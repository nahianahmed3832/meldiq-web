import { useState } from "react";
import type { Conversation } from "../../api/schemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { NOTIFY_LEVELS, parentLevel, workspaceOf, type NotifyLevel } from "../../sync/navPrefs";
import { text as t, useT } from "../../i18n";

export const NOTIFICATION_LEVEL_LABELS: Record<NotifyLevel, string> = {
  get all() {
    return t("notifications.bell_all");
  },
  get mentions() {
    return t("notifications.bell_mentions");
  },
  get none() {
    return t("notifications.bell_nothing");
  },
};
export function NotificationLevelSelect({ conversation }: { conversation: Conversation }) {
  const engine = useEngine();
  const t = useT();
  const nav = useOrbit((s) => s.nav[workspaceOf(conversation.orgId)]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const level = nav?.notify[conversation.id] ?? "default";
  const change = async (value: string) => {
    setBusy(true);
    setError(null);
    try {
      await engine.arrange(
        conversation.id,
        value === "default"
          ? { op: "notifyReset", conversationId: conversation.id }
          : { op: "notify", conversationId: conversation.id, level: value as NotifyLevel, categoryId: conversation.categoryId ?? null },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : t("notifications.bell_failed"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <select className="input input-sm" aria-label={t("settings.notifications")} disabled={busy} value={level} onChange={(e) => void change(e.target.value)}>
        <option value="default">{t("notifications.bell_default", { level: NOTIFICATION_LEVEL_LABELS[parentLevel(nav, conversation.categoryId ?? null)] })}</option>
        {NOTIFY_LEVELS.map((level) => (
          <option key={level} value={level}>
            {NOTIFICATION_LEVEL_LABELS[level]}
          </option>
        ))}
      </select>
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </>
  );
}
