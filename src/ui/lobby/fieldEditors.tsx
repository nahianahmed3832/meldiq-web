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
  return (
    <span className="lobby-row-tools">
      <button className="icon-btn" disabled={index === 0} aria-label={`Move ${label} up`} onClick={() => onMove(index - 1)}>
        <ArrowUp size={15} />
      </button>
      <button className="icon-btn" disabled={index === count - 1} aria-label={`Move ${label} down`} onClick={() => onMove(index + 1)}>
        <ArrowDown size={15} />
      </button>
      <button className="icon-btn" aria-label={`Remove ${label}`} onClick={onRemove}>
        <Minus size={15} />
      </button>
    </span>
  );
}

/** Main channels: up to six, in the order people should tap them. */
export function ChannelPicker({ value, onChange, channels }: ListProps<string> & { channels: readonly LobbyChannel[] }) {
  const byId = new Map(channels.map((c) => [c.id, c]));
  const left = channels.filter((c) => !value.includes(c.id));
  return (
    <div className="lobby-list-edit">
      {value.length === 0 && <p className="muted">None picked: the lobby shows this week's busiest channels each person can see.</p>}
      {value.map((id, i) => {
        const name = byId.get(id)?.name ?? "a channel you can't see";
        return (
          <div key={id} className="lobby-list-row">
            <span className="lobby-order">{i + 1}</span>
            <span className="grow ellipsis">#{name}</span>
            <MoveButtons index={i} count={value.length} label={`#${name}`} onMove={(to) => onChange(moveItem(value, i, to))} onRemove={() => onChange(value.filter((x) => x !== id))} />
          </div>
        );
      })}
      {value.length < LOBBY_LIMITS.mainChannels && left.length > 0 && (
        <select className="input" aria-label="Add a main channel" value="" onChange={(e) => e.target.value && onChange([...value, e.target.value])}>
          <option value="">Add a channel…</option>
          {left.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.name ?? "channel"}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

/** The FAQ: up to ten questions, each with its answer. */
export function FaqEditor({ value, onChange }: ListProps<LobbyFaqItem>) {
  const set = (i: number, patch: Partial<LobbyFaqItem>) => onChange(value.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  return (
    <div className="lobby-list-edit">
      {value.map((q, i) => (
        <div key={q.id} className="lobby-faq-edit">
          <div className="row" style={{ gap: 6 }}>
            <input
              className="input grow"
              aria-label={`Question ${i + 1}`}
              placeholder="What do people ask?"
              maxLength={LOBBY_LIMITS.question}
              value={q.question}
              onChange={(e) => set(i, { question: e.target.value })}
            />
            <MoveButtons index={i} count={value.length} label={`question ${i + 1}`} onMove={(to) => onChange(moveItem(value, i, to))} onRemove={() => onChange(value.filter((_, j) => j !== i))} />
          </div>
          <textarea
            className="textarea"
            rows={2}
            aria-label={`Answer ${i + 1}`}
            placeholder="The answer"
            maxLength={LOBBY_LIMITS.answer}
            value={q.answer}
            onChange={(e) => set(i, { answer: e.target.value })}
          />
        </div>
      ))}
      {value.length < LOBBY_LIMITS.faq && (
        <button className="btn btn-secondary btn-sm" style={{ justifySelf: "start" }} onClick={() => onChange([...value, blankQuestion()])}>
          <Plus size={14} /> Add question
        </button>
      )}
    </div>
  );
}

/** The top buttons: up to four, each opening a channel or an https link; the first is the primary one. */
export function ButtonsEditor({ value, onChange, channels }: ListProps<LobbyButton> & { channels: readonly LobbyChannel[] }) {
  const set = (i: number, patch: Partial<LobbyButton>) => onChange(value.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const texts = channels.filter((c) => !c.voice);
  return (
    <div className="lobby-list-edit">
      {value.map((b, i) => (
        <div key={i} className="lobby-faq-edit">
          <div className="row" style={{ gap: 6 }}>
            <input
              className="input grow"
              aria-label={`Button ${i + 1} label`}
              placeholder={i === 0 ? "Say hi" : "Our site"}
              maxLength={LOBBY_LIMITS.buttonLabel}
              value={b.label}
              onChange={(e) => set(i, { label: e.target.value })}
            />
            <MoveButtons index={i} count={value.length} label={`button ${i + 1}`} onMove={(to) => onChange(moveItem(value, i, to))} onRemove={() => onChange(value.filter((_, j) => j !== i))} />
          </div>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            <select
              className="input"
              style={{ flex: "1 1 140px" }}
              aria-label={`Button ${i + 1} opens`}
              value={b.channelId ?? (b.url !== null ? "::link" : "")}
              onChange={(e) => set(i, e.target.value === "::link" ? { channelId: null, url: b.url ?? "https://" } : { channelId: e.target.value || null, url: null })}
            >
              <option value="">Opens…</option>
              <option value="::link">A website</option>
              {texts.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.name ?? "channel"}
                </option>
              ))}
            </select>
            {!b.channelId && b.url !== null && (
              <input
                className="input"
                style={{ flex: "2 1 180px" }}
                type="url"
                inputMode="url"
                aria-label={`Button ${i + 1} link`}
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
          <Plus size={14} /> Add a button
        </button>
      )}
    </div>
  );
}
