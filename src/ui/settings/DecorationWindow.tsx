import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
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
  if (!id) return uiText("settings.ap_none");
  return DECORATION_LABEL[id] ?? catalog.data?.decorations.find((d) => d.id === id)?.name ?? "…";
}
/**
 * Settings › My Profile › Avatar decoration (the reference, 2026-10-29): the catalog on the left, your pick shown big,
 * in a message and in the member list on the right, and nothing saved until Apply.
 */
export function DecorationWindow({ me, photoRev, current, onApply, onClose }: DecorationWindowProps) {
  useLocaleRender();
  const l10n = useLocalization();
  const [draft, setDraft] = useState<string | null>(current);
  const name = useDecorationName(draft);
  const avatar = (size: number) => <StyledAvatar userId={me.userId} name={me.displayName} colorIndex={me.avatarColor} photoRev={photoRev} media={null} decoration={draft} size={size} />;
  return (
    <Dialog
      title={uiText("settings.interface.change_avatar_decoration_4389752")}
      onClose={onClose}
      width="min(1000px, 96vw)"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {l10n("common.actions.cancel")}
          </button>
          <button type="button" className="btn btn-primary" disabled={draft === current} onClick={() => onApply(draft)}>
            <Localized k="workspace.interface.apply_31e392d" />
          </button>
        </>
      }
    >
      <div className="dialog-body style-window">
        <div className="style-window-main">
          <DecorationPicker me={me} photoRev={photoRev} current={draft} onPick={setDraft} />
        </div>
        <div className="style-window-preview" aria-label={uiText("organization.interface.preview_324b134")} aria-live="polite">
          <div className="style-window-stage">{avatar(112)}</div>
          <div className="style-window-samples card">
            <div className="style-sample-msg">
              {avatar(40)}
              <div className="lines">
                <span>
                  <strong>{me.displayName}</strong>{" "}
                  <small className="faint">
                    <Localized k="settings.interface.today_at_12_00_71db32a" />
                  </small>
                </span>
                <span>
                  <Localized k="settings.interface.look_at_my_new_decoration_204d57f" />
                </span>
              </div>
            </div>
            <div className="style-sample-member">
              {avatar(32)}
              <strong className="ellipsis">{me.displayName}</strong>
            </div>
          </div>
          <div>
            <div className="settings-label">{draft ? uiText("settings.interface.decoration_7b39a9f") : uiText("settings.interface.no_decoration_66c17c8")}</div>
            <strong>{name}</strong>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
