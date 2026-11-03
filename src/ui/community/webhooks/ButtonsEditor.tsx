import { useLocaleRender } from "../../../i18n/Localized";
import { text as uiText } from "../../../i18n";
import { Localized } from "../../../i18n/Localized";
import { Plus, X } from "lucide-react";
import { DRAFT_LIMITS, type DraftButton, emptyButton } from "../../../sync/posting/draft";
import { POST_LIMITS } from "../../../sync/posting/embeds";
/** "Make a post" › Link buttons: an emoji, a label and an https address each, up to 5. */
export function ButtonsEditor({ buttons, onChange }: { buttons: DraftButton[]; onChange: (b: DraftButton[]) => void }) {
  useLocaleRender();
  const set = (i: number, change: Partial<DraftButton>) => onChange(buttons.map((b, j) => (j === i ? { ...b, ...change } : b)));
  return (
    <section className="builder-section" aria-label={uiText("organization.interface.link_buttons_49abcc3")}>
      <h4 className="builder-label">
        <Localized k="organization.interface.link_buttons_49abcc3" />
      </h4>
      {buttons.map((b, i) => (
        <div key={b.key} className="button-editor">
          <input
            className="input button-emoji"
            aria-label={uiText("organization.interface.button_value0_emoji_0d267b7", { value0: i + 1 })}
            placeholder="🙂"
            value={b.emoji}
            maxLength={DRAFT_LIMITS.emoji}
            onChange={(e) => set(i, { emoji: e.target.value })}
          />
          <input
            className="input"
            aria-label={uiText("organization.interface.button_value0_label_002de1e", { value0: i + 1 })}
            placeholder={uiText("organization.interface.label_0e66373")}
            value={b.label}
            maxLength={DRAFT_LIMITS.buttonLabel}
            onChange={(e) => set(i, { label: e.target.value })}
          />
          <input
            className="input grow"
            aria-label={uiText("organization.interface.button_value0_address_f3a54f0", { value0: i + 1 })}
            placeholder="https://"
            value={b.url}
            maxLength={POST_LIMITS.url}
            onChange={(e) => set(i, { url: e.target.value })}
          />
          <button
            type="button"
            className="icon-btn icon-btn-xs"
            aria-label={uiText("organization.interface.remove_button_value0_af29954", { value0: i + 1 })}
            onClick={() => onChange(buttons.filter((_, j) => j !== i))}
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <div>
        <button type="button" className="btn btn-ghost btn-sm" disabled={buttons.length >= DRAFT_LIMITS.buttons} onClick={() => onChange([...buttons, emptyButton()])}>
          <Localized k="organization.interface.add_button_84b714f" slots={[<Plus size={14} />]} />
        </button>
      </div>
    </section>
  );
}
