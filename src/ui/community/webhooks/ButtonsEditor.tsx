import { Plus, X } from "lucide-react";
import { DRAFT_LIMITS, type DraftButton, emptyButton } from "../../../sync/posting/draft";
import { POST_LIMITS } from "../../../sync/posting/embeds";

/** "Make a post" › Link buttons: an emoji, a label and an https address each, up to 5. */
export function ButtonsEditor({ buttons, onChange }: { buttons: DraftButton[]; onChange: (b: DraftButton[]) => void }) {
  const set = (i: number, change: Partial<DraftButton>) => onChange(buttons.map((b, j) => (j === i ? { ...b, ...change } : b)));
  return (
    <section className="builder-section" aria-label="Link buttons">
      <h4 className="builder-label">Link buttons</h4>
      {buttons.map((b, i) => (
        <div key={b.key} className="button-editor">
          <input
            className="input button-emoji"
            aria-label={`Button ${i + 1} emoji`}
            placeholder="🙂"
            value={b.emoji}
            maxLength={DRAFT_LIMITS.emoji}
            onChange={(e) => set(i, { emoji: e.target.value })}
          />
          <input className="input" aria-label={`Button ${i + 1} label`} placeholder="Label" value={b.label} maxLength={DRAFT_LIMITS.buttonLabel} onChange={(e) => set(i, { label: e.target.value })} />
          <input className="input grow" aria-label={`Button ${i + 1} address`} placeholder="https://" value={b.url} maxLength={POST_LIMITS.url} onChange={(e) => set(i, { url: e.target.value })} />
          <button type="button" className="icon-btn icon-btn-xs" aria-label={`Remove button ${i + 1}`} onClick={() => onChange(buttons.filter((_, j) => j !== i))}>
            <X size={14} />
          </button>
        </div>
      ))}
      <div>
        <button type="button" className="btn btn-ghost btn-sm" disabled={buttons.length >= DRAFT_LIMITS.buttons} onClick={() => onChange([...buttons, emptyButton()])}>
          <Plus size={14} /> Add button
        </button>
      </div>
    </section>
  );
}
