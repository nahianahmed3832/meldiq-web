import { Plus, X } from "lucide-react";
import { useState } from "react";
import type { Poll } from "../../protocol/payload";
import { composePoll, duplicatePollAnswers, MAX_OPTION, MAX_OPTIONS, MAX_QUESTION, MIN_OPTIONS } from "../../sync/polls";
import { Dialog } from "../components/Overlay";
import { Toggle } from "../components/Toggle";

/** A new poll (android Attach › Poll): a question, two to ten options, and whether several answers are allowed. */
export function PollDialog({ onSend, onClose }: { onSend: (poll: Poll) => void; onClose: () => void }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multi, setMulti] = useState(false);
  const [duration, setDuration] = useState("0");
  const poll = composePoll(question, options, multi);
  const set = (i: number, v: string) => setOptions((o) => o.map((x, j) => (j === i ? v : x)));
  return (
    <Dialog
      title="New poll"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={!poll}
            onClick={() => {
              const ready = composePoll(question, options, multi, Number(duration) ? Date.now() + Number(duration) * 60_000 : undefined);
              if (ready) onSend(ready);
            }}
          >
            Send poll
          </button>
        </>
      }
    >
      <div className="dialog-body">
        <label className="field">
          <span>Question</span>
          <input className="input" value={question} maxLength={MAX_QUESTION} onChange={(e) => setQuestion(e.target.value)} autoFocus />
        </label>
        <div className="field">
          <span>Options</span>
          {options.map((o, i) => (
            <div key={i} className="row" style={{ gap: 6 }}>
              <input className="input" value={o} maxLength={MAX_OPTION} onChange={(e) => set(i, e.target.value)} aria-label={`Option ${i + 1}`} placeholder={`Option ${i + 1}`} />
              {options.length > MIN_OPTIONS && (
                <button className="icon-btn" aria-label={`Remove option ${i + 1}`} onClick={() => setOptions((x) => x.filter((_, j) => j !== i))}>
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
          {options.length < MAX_OPTIONS && (
            <button className="btn btn-ghost btn-sm" style={{ justifySelf: "start" }} onClick={() => setOptions((x) => [...x, ""])}>
              <Plus size={14} /> Add option
            </button>
          )}
        </div>
        {duplicatePollAnswers(options) && (
          <p className="poll-error" role="alert">
            Each answer must be different.
          </p>
        )}
        <label className="field">
          <span>Close voting</span>
          <select className="input" value={duration} onChange={(e) => setDuration(e.target.value)}>
            <option value="0">When I close the poll</option>
            <option value="60">After 1 hour</option>
            <option value="1440">After 24 hours</option>
            <option value="4320">After 3 days</option>
            <option value="10080">After 7 days</option>
          </select>
        </label>
        <div className="row" style={{ gap: 10 }}>
          <span className="grow">Allow several answers</span>
          <Toggle label="Allow several answers" checked={multi} onChange={setMulti} />
        </div>
        <span className="hint">Voters can show their name or choose Anonymous voter in results. Only you can close the poll early.</span>
      </div>
    </Dialog>
  );
}
