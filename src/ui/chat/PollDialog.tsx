import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import type { Poll } from "../../protocol/payload";
import { composePoll, duplicatePollAnswers, MAX_OPTION, MAX_OPTIONS, MAX_QUESTION, MIN_OPTIONS } from "../../sync/polls";
import { Dialog } from "../components/Overlay";
import { Toggle } from "../components/Toggle";
/** A new poll (android Attach › Poll): a question, two to ten options, and whether several answers are allowed. */
export function PollDialog({ onSend, onClose }: { onSend: (poll: Poll) => void; onClose: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multi, setMulti] = useState(false);
  const [duration, setDuration] = useState("0");
  const poll = composePoll(question, options, multi);
  const set = (i: number, v: string) => setOptions((o) => o.map((x, j) => (j === i ? v : x)));
  return (
    <Dialog
      title={uiText("messaging.interface.new_poll_e4aa64f")}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            {l10n("common.actions.cancel")}
          </button>
          <button
            className="btn btn-primary"
            disabled={!poll}
            onClick={() => {
              const ready = composePoll(question, options, multi, Number(duration) ? Date.now() + Number(duration) * 60000 : undefined);
              if (ready) onSend(ready);
            }}
          >
            <Localized k="messaging.interface.send_poll_e6b7b5b" />
          </button>
        </>
      }
    >
      <div className="dialog-body">
        <label className="field">
          <span>
            <Localized k="messaging.interface.question_289aff1" />
          </span>
          <input className="input" value={question} maxLength={MAX_QUESTION} onChange={(e) => setQuestion(e.target.value)} autoFocus />
        </label>
        <div className="field">
          <span>
            <Localized k="messaging.interface.options_d0db8b5" />
          </span>
          {options.map((o, i) => (
            <div key={i} className="row" style={{ gap: 6 }}>
              <input
                className="input"
                value={o}
                maxLength={MAX_OPTION}
                onChange={(e) => set(i, e.target.value)}
                aria-label={uiText("messaging.interface.option_value0_ce4bc00", { value0: i + 1 })}
                placeholder={uiText("messaging.interface.option_value0_ce4bc00", { value0: i + 1 })}
              />
              {options.length > MIN_OPTIONS && (
                <button className="icon-btn" aria-label={uiText("messaging.interface.remove_option_value0_f13ad12", { value0: i + 1 })} onClick={() => setOptions((x) => x.filter((_, j) => j !== i))}>
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
          {options.length < MAX_OPTIONS && (
            <button className="btn btn-ghost btn-sm" style={{ justifySelf: "start" }} onClick={() => setOptions((x) => [...x, ""])}>
              <Localized k="messaging.interface.add_option_429fcc0" slots={[<Plus size={14} />]} />
            </button>
          )}
        </div>
        {duplicatePollAnswers(options) && (
          <p className="poll-error" role="alert">
            <Localized k="messaging.interface.each_answer_must_be_different_aa8fdf0" />
          </p>
        )}
        <label className="field">
          <span>
            <Localized k="messaging.interface.close_voting_8de75fe" />
          </span>
          <select className="input" value={duration} onChange={(e) => setDuration(e.target.value)}>
            <option value="0">
              <Localized k="messaging.interface.when_i_close_the_poll_724f880" />
            </option>
            <option value="60">
              <Localized k="messaging.interface.after_1_hour_57cc7b5" />
            </option>
            <option value="1440">
              <Localized k="messaging.interface.after_24_hours_f64edb0" />
            </option>
            <option value="4320">
              <Localized k="messaging.interface.after_3_days_21b6268" />
            </option>
            <option value="10080">
              <Localized k="messaging.interface.after_7_days_a166017" />
            </option>
          </select>
        </label>
        <div className="row" style={{ gap: 10 }}>
          <span className="grow">
            <Localized k="messaging.interface.allow_several_answers_2b3c943" />
          </span>
          <Toggle label={uiText("messaging.interface.allow_several_answers_2b3c943")} checked={multi} onChange={setMulti} />
        </div>
        <span className="hint">
          <Localized k="messaging.interface.voters_can_show_their_name_or_choose_anonymous_voter_in_results_o_7ac874d" />
        </span>
      </div>
    </Dialog>
  );
}
