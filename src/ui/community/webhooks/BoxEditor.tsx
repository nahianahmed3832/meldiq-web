import { MARKDOWN_SYNTAX } from "../../../i18n/syntax";
import { useLocaleRender } from "../../../i18n/Localized";
import { text as uiText } from "../../../i18n";
import { Localized } from "../../../i18n/Localized";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Heading, X } from "lucide-react";
import { useState } from "react";
import { DRAFT_LIMITS, type DraftBox } from "../../../sync/posting/draft";
import { POST_LIMITS } from "../../../sync/posting/embeds";
interface BoxEditorProps {
  box: DraftBox;
  index: number;
  count: number;
  onChange: (b: DraftBox) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}
/** One box of "Make a post": colour, title, text (markdown); More: title link, author line, pictures, footer. */
export function BoxEditor({ box, index, count, onChange, onMove, onRemove }: BoxEditorProps) {
  useLocaleRender();
  const [more, setMore] = useState(!!(box.url || box.author || box.image || box.thumbnail || box.footer));
  const set = (change: Partial<DraftBox>) => onChange({ ...box, ...change });
  const id = (f: string) => `${box.key}-${f}`;
  const n = index + 1;
  return (
    <fieldset className="box-editor" style={box.color ? { borderInlineStartColor: box.color } : undefined}>
      <legend className="box-editor-head">
        <strong>
          <Localized k="organization.interface.box_99b421f" slots={[n]} />
        </strong>
        <span className="grow" />
        <button
          type="button"
          className="icon-btn icon-btn-xs"
          aria-label={uiText("organization.interface.move_box_value0_up_1503633", { value0: n })}
          disabled={index === 0}
          onClick={() => onMove(-1)}
        >
          <ArrowUp size={14} />
        </button>
        <button
          type="button"
          className="icon-btn icon-btn-xs"
          aria-label={uiText("organization.interface.move_box_value0_down_f543cf0", { value0: n })}
          disabled={index === count - 1}
          onClick={() => onMove(1)}
        >
          <ArrowDown size={14} />
        </button>
        <button type="button" className="icon-btn icon-btn-xs" aria-label={uiText("organization.interface.remove_box_value0_5f130ae", { value0: n })} onClick={onRemove}>
          <X size={14} />
        </button>
      </legend>
      <div className="box-editor-row">
        <label className="box-color" htmlFor={id("color")}>
          <input
            id={id("color")}
            type="color"
            value={box.color || "#5865f2"}
            aria-label={uiText("organization.interface.box_value0_colour_4cc876f", { value0: n })}
            onChange={(e) => set({ color: e.target.value })}
          />
        </label>
        <input
          className="input grow"
          aria-label={uiText("organization.interface.box_value0_title_ac790aa", { value0: n })}
          placeholder={uiText("messaging.interface.title_7e8cd20")}
          value={box.title}
          maxLength={DRAFT_LIMITS.title}
          onChange={(e) => set({ title: e.target.value })}
        />
      </div>
      <textarea
        className="textarea"
        aria-label={uiText("organization.interface.box_value0_text_35f9cbb", { value0: n })}
        placeholder={`${uiText("organization.interface.text_71988c4")}: ${MARKDOWN_SYNTAX}`}
        rows={4}
        value={box.description}
        maxLength={DRAFT_LIMITS.description}
        onChange={(e) => set({ description: e.target.value })}
      />
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => set({ description: uiText("organization.interface.heading_620fd41", { value0: box.description, value1: box.description ? "\n" : "" }) })}
        >
          <Localized k="organization.interface.add_heading_71d9386" slots={[<Heading size={14} />]} />
        </button>
        <button type="button" className="btn btn-ghost btn-sm" aria-expanded={more} onClick={() => setMore(!more)}>
          <Localized k="organization.interface.more_6790cbc" slots={[more ? <ChevronDown size={14} /> : <ChevronRight size={14} />]} />
        </button>
      </div>
      {more && (
        <div className="box-editor-more">
          <Field label={uiText("organization.interface.title_link_b477926")} value={box.url} placeholder="https://" onChange={(url) => set({ url })} />
          <Field label={uiText("organization.interface.author_line_c18bfcd")} value={box.author} max={DRAFT_LIMITS.author} onChange={(author) => set({ author })} />
          <Field
            label={uiText("organization.interface.big_picture_e8a9aad")}
            value={box.image}
            placeholder={uiText("organization.interface.https_under_the_text_639243c")}
            onChange={(image) => set({ image })}
          />
          <Field
            label={uiText("organization.interface.small_picture_1a973c4")}
            value={box.thumbnail}
            placeholder={uiText("organization.interface.https_top_right_108cdbf")}
            onChange={(thumbnail) => set({ thumbnail })}
          />
          <Field label={uiText("organization.interface.footer_26c87bb")} value={box.footer} max={DRAFT_LIMITS.footer} onChange={(footer) => set({ footer })} />
        </div>
      )}
    </fieldset>
  );
}
function Field({ label, value, placeholder, max, onChange }: { label: string; value: string; placeholder?: string; max?: number; onChange: (v: string) => void }) {
  useLocaleRender();
  return (
    <label className="field">
      <span className="label">{label}</span>
      <input className="input" value={value} placeholder={placeholder} maxLength={max ?? POST_LIMITS.url} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
