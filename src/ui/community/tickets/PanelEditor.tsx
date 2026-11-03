import { useLocaleRender } from "../../../i18n/Localized";
import { text as uiText } from "../../../i18n";
import { Localized } from "../../../i18n/Localized";
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
  useLocaleRender();
  const set = (c: Partial<PanelDraft>) => onChange({ ...panel, ...c });
  const text = channels.filter((c) => !c.voice && c.format !== "forum");
  // The panel's message goes in a channel everyone can read: public or announcement text channels.
  const open = text.filter((c) => c.kind !== "PRIVATE");
  const id = (f: string) => `panel-${index}-${f}`;
  return (
    <fieldset className="panel-editor">
      <legend className="box-editor-head">
        <strong>
          <Localized k="organization.interface.panel_80d6546" slots={[index + 1]} />
        </strong>
        <span className="grow" />
        <button type="button" className="icon-btn icon-btn-xs" aria-label={uiText("organization.interface.remove_panel_value0_9ea7bf0", { value0: index + 1 })} onClick={onRemove}>
          <X size={14} />
        </button>
      </legend>
      <div className="field">
        <label htmlFor={id("name")}>
          <Localized k="messaging.interface.name_dcd1d52" />
        </label>
        <input
          id={id("name")}
          className="input"
          placeholder={uiText("organization.interface.support_be91940")}
          value={panel.name}
          maxLength={PANEL_NAME_MAX}
          onChange={(e) => set({ name: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor={id("post")}>
          <Localized k="organization.interface.post_the_panel_in_752857b" />
        </label>
        <select id={id("post")} className="input" value={panel.postChannelId} onChange={(e) => set({ postChannelId: e.target.value })}>
          <option value="">
            <Localized k="organization.interface.pick_a_channel_7ed32e3" />
          </option>
          {open.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={id("category")}>
          <Localized k="organization.interface.tickets_open_in_959c71c" />
        </label>
        <select id={id("category")} className="input" value={panel.categoryId ?? ""} onChange={(e) => set({ categoryId: e.target.value || null })}>
          <option value="">
            <Localized k="organization.interface.a_tickets_category_made_for_you_7373af0" />
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={id("log")}>
          <Localized k="organization.interface.log_channel_1c1b4e9" />
        </label>
        <select id={id("log")} className="input" value={panel.logChannelId ?? ""} onChange={(e) => set({ logChannelId: e.target.value || null })}>
          <option value="">
            <Localized k="organization.interface.no_log_f9d2a4a" />
          </option>
          {text.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.name}
            </option>
          ))}
        </select>
        <span className="hint">
          <Localized k="organization.interface.opened_and_closed_tickets_are_noted_there_a_private_channel_is_be_a45b312" />
        </span>
      </div>
      {extras && (
        <>
          <BotField
            label={uiText("organization.interface.support_role_1cb11e1")}
            hint={uiText("organization.interface.sees_this_panel_s_tickets_and_is_pinged_when_one_opens_2d34657")}
            plus
            botsPlus={botsPlus}
          >
            <select
              className="input"
              aria-label={uiText("organization.interface.panel_value0_support_role_3485058", { value0: index + 1 })}
              value={panel.supportRoleId ?? ""}
              onChange={(e) => set({ supportRoleId: e.target.value || null })}
            >
              <option value="">
                <Localized k="organization.interface.no_support_role_daf5c3e" />
              </option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  @{r.name}
                </option>
              ))}
            </select>
          </BotField>
          <BotField
            label={uiText("organization.interface.welcome_line_e96fbdb")}
            hint={uiText("organization.interface.said_in_each_new_ticket_user_mentions_the_opener_panel_is_this_pa_0b202f9")}
            plus
            botsPlus={botsPlus}
          >
            <textarea
              className="input"
              rows={2}
              maxLength={PANEL_WELCOME_MAX}
              aria-label={uiText("organization.interface.panel_value0_welcome_line_64ff2ff", { value0: index + 1 })}
              placeholder={uiText("organization.interface.hi_user_thanks_for_reaching_panel_someone_will_be_with_you_soon_9639ecf")}
              value={panel.welcomeMessage ?? ""}
              onChange={(e) => set({ welcomeMessage: e.target.value || null })}
            />
          </BotField>
        </>
      )}
      {canPost && (
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={onPost}>
            <Send size={14} /> {posted ? uiText("organization.interface.post_the_panel_again_0e52341") : uiText("organization.interface.post_the_panel_56297ed")}
          </button>
          <small className="faint">
            <Localized k="organization.interface.a_message_with_an_open_a_ticket_button_0189ed3" />
          </small>
        </div>
      )}
    </fieldset>
  );
}
