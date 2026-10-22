import { X } from "lucide-react";
import type { ReactNode } from "react";

/** A side panel's title row with its close button. */
export function PanelHead({ title, sub, onClose, actions }: { title: string; sub?: string; onClose: () => void; actions?: ReactNode }) {
  return (
    <div className="panel-head">
      <div className="grow" style={{ minWidth: 0 }}>
        <h2 className="ellipsis">{title}</h2>
        {sub && <small className="ellipsis">{sub}</small>}
      </div>
      {actions}
      <button className="icon-btn" onClick={onClose} aria-label="Close panel">
        <X size={18} />
      </button>
    </div>
  );
}
