import { RefreshCw } from "lucide-react";
import { applyUpdate, useUpdateReady } from "../application/updates";

/** A newer release is on the server: one click reloads into it (Discord's update button). */
export function UpdateNotice() {
  const ready = useUpdateReady();
  if (!ready) return null;
  return (
    <div className="update-notice" role="status">
      <span className="grow">A new version of Meldiq is ready.</span>
      <button className="btn btn-primary btn-sm" onClick={applyUpdate}>
        <RefreshCw size={14} /> Reload
      </button>
    </div>
  );
}
