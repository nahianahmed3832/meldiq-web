import { formatUiNumber } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { ArrowDown, ArrowUp, Minus, Plus } from "lucide-react";
import { LOBBY_LIMITS, type LobbyButton, type LobbyChannel, type LobbyFaqItem } from "../../api/lobbySchemas";
import { blankButton, blankQuestion, moveItem } from "../../sync/lobbyDraft";
/**
 * The lobby's list editors, shared by the live editor's card panels and Community settings › Lobby: main channels,
 * the FAQ and the top buttons. Each takes its list and hands back a new one.
 */
interface ListProps<T> {
  value: readonly T[];
  onChange: (next: T[]) => void;
}
function MoveButtons({ index, count, label, onMove, onRemove }: { index: number; count: number; label: string; onMove: (to: number) => void; onRemove: () => void }) {
  useLocaleRender();
  return (
    <span className="lobby-row-tools">
      <button className="icon-btn" disabled={index === 0} aria-label={uiText("organization.interface.move_value0_up_4f93d15", { value0: label })} onClick={() => onMove(index - 1)}>
        <ArrowUp size={15} />
      </button>
      <button className="icon-btn" disabled={index === count - 1} aria-label={uiText("organization.interface.move_value0_down_7c18b9e", { value0: label })} onClick={() => onMove(index + 1)}>
        <ArrowDown size={15} />
      </button>
      <button className="icon-btn" aria-label={uiText("messaging.interface.remove_value0_3028bf7", { value0: label })} onClick={onRemove}>
        <Minus size={15} />
      </button>
    </span>
  );
}
/** Main channels: up to six, in the order people should tap them. */
export function ChannelPicker({
  value,
  onChange,
  channels,
}: ListProps<string> & {
  channels: readonly LobbyChannel[];
}) {
  useLocaleRender();
  const byId = new Map(channels.map((c) => [c.id, c]));
  const left = channels.filter((c) => !value.includes(c.id));
  return (
    <div className="lobby-list-edit">
      {value.length === 0 && (
        <p className="muted">
          <Localized k="workspace.interface.none_picked_the_lobby_shows_this_week_s_busiest_channels_each_per_e5d3630" />
        </p>
      )}
      {value.map((id, i) => {
        const name = byId.get(id)?.name ?? uiText("workspace.interface.a_channel_you_can_t_see_3ed17d1");
        return (
          <div key={id} className="lobby-list-row">
            <span className="lobby-order">{formatUiNumber(i + 1)}</span>
            <span className="grow ellipsis">#{name}</span>
            <MoveButtons
              index={i}
              count={value.length}
              label={uiText("messaging.interface.value0_dbac6f0", { value0: name })}
              onMove={(to) => onChange(moveItem(value, i, to))}
              onRemove={() => onChange(value.filter((x) => x !== id))}
            />
          </div>
        );
      })}
      {value.length < LOBBY_LIMITS.mainChannels && left.length > 0 && (
        <select className="input" aria-label={uiText("workspace.interface.add_a_main_channel_1aedc0a")} value="" onChange={(e) => e.target.value && onChange([...value, e.target.value])}>
          <option value="">
            <Localized k="workspace.interface.add_a_channel_d120ac7" />
          </option>
          {left.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.name ?? uiText("messaging.interface.channel_69e3656")}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
/** The FAQ: up to ten questions, each with its answer. */
export function FaqEditor({ value, onChange }: ListProps<LobbyFaqItem>) {
  useLocaleRender();
  const set = (i: number, patch: Partial<LobbyFaqItem>) => onChange(value.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  return (
    <div className="lobby-list-edit">
      {value.map((q, i) => (
        <div key={q.id} className="lobby-faq-edit">
          <div className="row" style={{ gap: 6 }}>
            <input
              className="input grow"
              aria-label={uiText("workspace.interface.question_value0_74865a9", { value0: i + 1 })}
              placeholder={uiText("workspace.interface.what_do_people_ask_f0fe92d")}
              maxLength={LOBBY_LIMITS.question}
              value={q.question}
              onChange={(e) => set(i, { question: e.target.value })}
            />
            <MoveButtons
              index={i}
              count={value.length}
              label={uiText("workspace.interface.question_value0_823ae8a", { value0: i + 1 })}
              onMove={(to) => onChange(moveItem(value, i, to))}
              onRemove={() => onChange(value.filter((_, j) => j !== i))}
            />
          </div>
          <textarea
            className="textarea"
            rows={2}
            aria-label={uiText("workspace.interface.answer_value0_08c81e7", { value0: i + 1 })}
            placeholder={uiText("workspace.interface.the_answer_f6c2c97")}
            maxLength={LOBBY_LIMITS.answer}
            value={q.answer}
            onChange={(e) => set(i, { answer: e.target.value })}
          />
        </div>
      ))}
      {value.length < LOBBY_LIMITS.faq && (
        <button className="btn btn-secondary btn-sm" style={{ justifySelf: "start" }} onClick={() => onChange([...value, blankQuestion()])}>
          <Localized k="workspace.interface.add_question_55deb54" slots={[<Plus size={14} />]} />
        </button>
      )}
    </div>
  );
}
/** The top buttons: up to four, each opening a channel or an https link; the first is the primary one. */
export function ButtonsEditor({
  value,
  onChange,
  channels,
}: ListProps<LobbyButton> & {
  channels: readonly LobbyChannel[];
}) {
  useLocaleRender();
  const set = (i: number, patch: Partial<LobbyButton>) => onChange(value.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const texts = channels.filter((c) => !c.voice);
  return (
    <div className="lobby-list-edit">
      {value.map((b, i) => (
        <div key={i} className="lobby-faq-edit">
          <div className="row" style={{ gap: 6 }}>
            <input
              className="input grow"
              aria-label={uiText("organization.interface.button_value0_label_002de1e", { value0: i + 1 })}
              placeholder={i === 0 ? uiText("workspace.interface.say_hi_71d5b29") : uiText("workspace.interface.our_site_acddec8")}
              maxLength={LOBBY_LIMITS.buttonLabel}
              value={b.label}
              onChange={(e) => set(i, { label: e.target.value })}
            />
            <MoveButtons
              index={i}
              count={value.length}
              label={uiText("workspace.interface.button_value0_9efb44e", { value0: i + 1 })}
              onMove={(to) => onChange(moveItem(value, i, to))}
              onRemove={() => onChange(value.filter((_, j) => j !== i))}
            />
          </div>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            <select
              className="input"
              style={{ flex: "1 1 140px" }}
              aria-label={uiText("workspace.interface.button_value0_opens_fadb93a", { value0: i + 1 })}
              value={b.channelId ?? (b.url !== null ? "::link" : "")}
              onChange={(e) => set(i, e.target.value === "::link" ? { channelId: null, url: b.url ?? "https://" } : { channelId: e.target.value || null, url: null })}
            >
              <option value="">
                <Localized k="workspace.interface.opens_17f5106" />
              </option>
              <option value="::link">
                <Localized k="workspace.interface.a_website_1f8cb63" />
              </option>
              {texts.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.name ?? uiText("messaging.interface.channel_69e3656")}
                </option>
              ))}
            </select>
            {!b.channelId && b.url !== null && (
              <input
                className="input"
                style={{ flex: "2 1 180px" }}
                type="url"
                inputMode="url"
                aria-label={uiText("workspace.interface.button_value0_link_0e76df3", { value0: i + 1 })}
                placeholder="https://"
                maxLength={LOBBY_LIMITS.url}
                value={b.url}
                onChange={(e) => set(i, { url: e.target.value })}
              />
            )}
          </div>
        </div>
      ))}
      {value.length < LOBBY_LIMITS.buttons && (
        <button className="btn btn-secondary btn-sm" style={{ justifySelf: "start" }} onClick={() => onChange([...value, blankButton()])}>
          <Localized k="workspace.interface.add_a_button_46652ce" slots={[<Plus size={14} />]} />
        </button>
      )}
    </div>
  );
}
