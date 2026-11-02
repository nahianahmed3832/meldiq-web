import { Send, X } from "lucide-react";
import type { Category } from "../../../api/communitySchemas";
import type { PanelChannel } from "../../../sync/communityRules";
import { PANEL_NAME_MAX, PANEL_WELCOME_MAX, type PanelDraft } from "../../../sync/posting/tickets";
import type { Role } from "../../../sync/roles";
import { BotField } from "../../workspace/bots/BotParts";

interface PanelEditorProps {
  panel: PanelDraft;
  index: number;
  channels: PanelChannel[];
  categories: Category[];
  /** The Tickets bot's Bots+ extras exist here (support role, welcome line). */
  extras: boolean;
  botsPlus: boolean;
  roles: Role[];
  /** Posting is offered for a saved panel while tickets are on. */
  canPost: boolean;
  posted: boolean;
  busy: boolean;
  onChange: (p: PanelDraft) => void;
  onRemove: () => void;
  onPost: () => void;
}

/** One ticket panel: its name, where its "Open a ticket" message goes, the category tickets open in, the log channel. */
export function PanelEditor({ panel, index, channels, categories, extras, botsPlus, roles, canPost, posted, busy, onChange, onRemove, onPost }: PanelEditorProps) {
  const set = (c: Partial<PanelDraft>) => onChange({ ...panel, ...c });
  const text = channels.filter((c) => !c.voice && c.format !== "forum");
  // The panel's message goes in a channel everyone can read: public or announcement text channels.
  const open = text.filter((c) => c.kind !== "PRIVATE");
  const id = (f: string) => `panel-${index}-${f}`;
  return (
    <fieldset className="panel-editor">
      <legend className="box-editor-head">
        <strong>Panel {index + 1}</strong>
        <span className="grow" />
        <button type="button" className="icon-btn icon-btn-xs" aria-label={`Remove panel ${index + 1}`} onClick={onRemove}>
          <X size={14} />
        </button>
      </legend>
      <div className="field">
        <label htmlFor={id("name")}>Name</label>
        <input id={id("name")} className="input" placeholder="Support" value={panel.name} maxLength={PANEL_NAME_MAX} onChange={(e) => set({ name: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor={id("post")}>Post the panel in</label>
        <select id={id("post")} className="input" value={panel.postChannelId} onChange={(e) => set({ postChannelId: e.target.value })}>
          <option value="">Pick a channel</option>
          {open.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={id("category")}>Tickets open in</label>
        <select id={id("category")} className="input" value={panel.categoryId ?? ""} onChange={(e) => set({ categoryId: e.target.value || null })}>
          <option value="">A "Tickets" category (made for you)</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={id("log")}>Log channel</label>
        <select id={id("log")} className="input" value={panel.logChannelId ?? ""} onChange={(e) => set({ logChannelId: e.target.value || null })}>
          <option value="">No log</option>
          {text.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.name}
            </option>
          ))}
        </select>
        <span className="hint">Opened and closed tickets are noted there. A private channel is best.</span>
      </div>
      {extras && (
        <>
          <BotField label="Support role" hint="Sees this panel's tickets and is pinged when one opens." plus botsPlus={botsPlus}>
            <select className="input" aria-label={`Panel ${index + 1} support role`} value={panel.supportRoleId ?? ""} onChange={(e) => set({ supportRoleId: e.target.value || null })}>
              <option value="">No support role</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  @{r.name}
                </option>
              ))}
            </select>
          </BotField>
          <BotField label="Welcome line" hint="Said in each new ticket. {user} mentions the opener, {panel} is this panel's name." plus botsPlus={botsPlus}>
            <textarea
              className="input"
              rows={2}
              maxLength={PANEL_WELCOME_MAX}
              aria-label={`Panel ${index + 1} welcome line`}
              placeholder="Hi {user}, thanks for reaching {panel}. Someone will be with you soon."
              value={panel.welcomeMessage ?? ""}
              onChange={(e) => set({ welcomeMessage: e.target.value || null })}
            />
          </BotField>
        </>
      )}
      {canPost && (
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={onPost}>
            <Send size={14} /> {posted ? "Post the panel again" : "Post the panel"}
          </button>
          <small className="faint">A message with an "Open a ticket" button.</small>
        </div>
      )}
    </fieldset>
  );
}
