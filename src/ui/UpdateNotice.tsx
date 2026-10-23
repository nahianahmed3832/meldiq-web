import { RefreshCw } from "lucide-react";
import { applyUpdate, useUpdateReady } from "../application/updates";
import { useT } from "../i18n";

/** A newer release is on the server: one click reloads into it (Discord's update button). */
export function UpdateNotice() {
  const ready = useUpdateReady();
  const t = useT();
  if (!ready) return null;
  return (
    <div className="update-notice" role="status">
      <span className="grow">{t("update_ready")}</span>
      <button className="btn btn-primary btn-sm" onClick={applyUpdate}>
        <RefreshCw size={14} /> {t("update_reload")}
      </button>
    </div>
  );
}
