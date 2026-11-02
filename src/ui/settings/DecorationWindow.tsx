import { useState } from "react";
import { useEngine } from "../../application/orbit";
import { decorationCatalog } from "../../sync/decorations";
import { Dialog } from "../components/Overlay";
import { DECORATION_LABEL, StyledAvatar } from "../people/ProfileStyle";
import { useLoad } from "../workspace/useLoad";
import { DecorationPicker } from "./DecorationPicker";

interface Me {
  userId: string;
  displayName: string;
  avatarColor: number;
}

interface DecorationWindowProps {
  me: Me;
  photoRev: number | null;
  current: string | null;
  onApply: (id: string | null) => void;
  onClose: () => void;
}

/** A decoration's name for people: the classic frames' labels, else the catalog's name. */
export function useDecorationName(id: string | null): string {
  const engine = useEngine();
  const catalog = useLoad(() => (id && !DECORATION_LABEL[id] ? decorationCatalog(engine) : Promise.resolve(null)), [engine, id]);
  if (!id) return "None";
  return DECORATION_LABEL[id] ?? catalog.data?.decorations.find((d) => d.id === id)?.name ?? "…";
}

/**
 * Settings › My Profile › Avatar decoration (the reference, 2026-10-29): the catalog on the left, your pick shown big,
 * in a message and in the member list on the right, and nothing saved until Apply.
 */
export function DecorationWindow({ me, photoRev, current, onApply, onClose }: DecorationWindowProps) {
  const [draft, setDraft] = useState<string | null>(current);
  const name = useDecorationName(draft);
  const avatar = (size: number) => <StyledAvatar userId={me.userId} name={me.displayName} colorIndex={me.avatarColor} photoRev={photoRev} media={null} decoration={draft} size={size} />;

  return (
    <Dialog
      title="Change avatar decoration"
      onClose={onClose}
      width="min(1000px, 96vw)"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={draft === current} onClick={() => onApply(draft)}>
            Apply
          </button>
        </>
      }
    >
      <div className="dialog-body style-window">
        <div className="style-window-main">
          <DecorationPicker me={me} photoRev={photoRev} current={draft} onPick={setDraft} />
        </div>
        <div className="style-window-preview" aria-label="Preview" aria-live="polite">
          <div className="style-window-stage">{avatar(112)}</div>
          <div className="style-window-samples card">
            <div className="style-sample-msg">
              {avatar(40)}
              <div className="lines">
                <span>
                  <strong>{me.displayName}</strong> <small className="faint">Today at 12:00</small>
                </span>
                <span>Look at my new decoration</span>
              </div>
            </div>
            <div className="style-sample-member">
              {avatar(32)}
              <strong className="ellipsis">{me.displayName}</strong>
            </div>
          </div>
          <div>
            <div className="settings-label">{draft ? "Decoration" : "No decoration"}</div>
            <strong>{name}</strong>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
