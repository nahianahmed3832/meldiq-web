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
  const [more, setMore] = useState(!!(box.url || box.author || box.image || box.thumbnail || box.footer));
  const set = (change: Partial<DraftBox>) => onChange({ ...box, ...change });
  const id = (f: string) => `${box.key}-${f}`;
  const n = index + 1;
  return (
    <fieldset className="box-editor" style={box.color ? { borderInlineStartColor: box.color } : undefined}>
      <legend className="box-editor-head">
        <strong>Box {n}</strong>
        <span className="grow" />
        <button type="button" className="icon-btn icon-btn-xs" aria-label={`Move box ${n} up`} disabled={index === 0} onClick={() => onMove(-1)}>
          <ArrowUp size={14} />
        </button>
        <button type="button" className="icon-btn icon-btn-xs" aria-label={`Move box ${n} down`} disabled={index === count - 1} onClick={() => onMove(1)}>
          <ArrowDown size={14} />
        </button>
        <button type="button" className="icon-btn icon-btn-xs" aria-label={`Remove box ${n}`} onClick={onRemove}>
          <X size={14} />
        </button>
      </legend>
      <div className="box-editor-row">
        <label className="box-color" htmlFor={id("color")}>
          <input id={id("color")} type="color" value={box.color || "#5865f2"} aria-label={`Box ${n} colour`} onChange={(e) => set({ color: e.target.value })} />
        </label>
        <input className="input grow" aria-label={`Box ${n} title`} placeholder="Title" value={box.title} maxLength={DRAFT_LIMITS.title} onChange={(e) => set({ title: e.target.value })} />
      </div>
      <textarea
        className="textarea"
        aria-label={`Box ${n} text`}
        placeholder="Text: **bold**, *italic*, [a link](https://…), - lists"
        rows={4}
        value={box.description}
        maxLength={DRAFT_LIMITS.description}
        onChange={(e) => set({ description: e.target.value })}
      />
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ description: `${box.description}${box.description ? "\n" : ""}## Heading` })}>
          <Heading size={14} /> Add heading
        </button>
        <button type="button" className="btn btn-ghost btn-sm" aria-expanded={more} onClick={() => setMore(!more)}>
          {more ? <ChevronDown size={14} /> : <ChevronRight size={14} />} More
        </button>
      </div>
      {more && (
        <div className="box-editor-more">
          <Field label="Title link" value={box.url} placeholder="https://" onChange={(url) => set({ url })} />
          <Field label="Author line" value={box.author} max={DRAFT_LIMITS.author} onChange={(author) => set({ author })} />
          <Field label="Big picture" value={box.image} placeholder="https://… (under the text)" onChange={(image) => set({ image })} />
          <Field label="Small picture" value={box.thumbnail} placeholder="https://… (top right)" onChange={(thumbnail) => set({ thumbnail })} />
          <Field label="Footer" value={box.footer} max={DRAFT_LIMITS.footer} onChange={(footer) => set({ footer })} />
        </div>
      )}
    </fieldset>
  );
}

function Field({ label, value, placeholder, max, onChange }: { label: string; value: string; placeholder?: string; max?: number; onChange: (v: string) => void }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      <input className="input" value={value} placeholder={placeholder} maxLength={max ?? POST_LIMITS.url} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
