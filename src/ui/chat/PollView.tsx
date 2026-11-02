import { BarChart3, Check, Clock3, EyeOff, Lock, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useEngine } from "../../application/orbit";
import type { StoredMessage } from "../../model/types";
import { pollClosed, pollPercentage, tally, voters } from "../../sync/polls";
import { Dialog } from "../components/Overlay";
import { Toggle } from "../components/Toggle";
import { PollResultsDialog } from "./PollResultsDialog";

/** A live poll with explicit counts, percent of voters and per-ballot name visibility. */
export function PollView({ m, myUserId, canPost }: { m: StoredMessage; myUserId: string; canPost: boolean }) {
  const engine = useEngine();
  const [now, setNow] = useState(Date.now);
  const [results, setResults] = useState(false);
  const [closing, setClosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anonymous, setAnonymous] = useState(m.rich?.votePrivacy?.[myUserId] === true);
  const rich = m.rich;
  const poll = rich?.poll;
  const myVisibility = rich?.votes?.[myUserId]?.length ? rich.votePrivacy?.[myUserId] === true : null;
  useEffect(() => {
    if (myVisibility !== null) setAnonymous(myVisibility);
  }, [m.id, myVisibility]);
  useEffect(() => {
    if (!poll?.endsAt || rich?.pollClosed || now >= poll.endsAt) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(25, Math.min(60_000, poll.endsAt - now + 25)));
    return () => clearTimeout(timer);
  }, [poll?.endsAt, rich?.pollClosed, now]);
  if (!rich || !poll) return null;
  const counts = tally(rich);
  const total = voters(rich);
  const mine = new Set(rich.votes?.[myUserId] ?? []);
  const closed = pollClosed(rich, now);
  const top = Math.max(0, ...counts.map((o) => o.votes));
  const submit = async (choices: string[], hidden = anonymous) => {
    if (closed || !canPost || busy) return;
    setBusy(true);
    setError(null);
    try {
      await engine.vote(m, choices, hidden);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your vote. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const choose = (id: string) => void submit(poll.multi ? (mine.has(id) ? [...mine].filter((x) => x !== id) : [...mine, id]) : mine.has(id) ? [] : [id]);
  const close = async () => {
    setBusy(true);
    setError(null);
    try {
      await engine.closePoll(m);
      setClosing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't close this poll. Try again.");
      setClosing(false);
    } finally {
      setBusy(false);
    }
  };
  const remaining = poll.endsAt ? Math.max(1, Math.ceil((poll.endsAt - now) / 60_000)) : null;
  const deadline = remaining ? (remaining >= 60 ? `Ends in ${Math.ceil(remaining / 60)}h` : `Ends in ${remaining}m`) : "";
  return (
    <div className={`poll${closed ? " is-closed" : ""}`} role="group" aria-label={`Poll: ${poll.question}`} aria-busy={busy}>
      <div className="poll-head">
        <span className="poll-symbol">
          <BarChart3 size={19} aria-hidden="true" />
        </span>
        <div className="poll-heading">
          <small>POLL · {poll.multi ? "MULTIPLE ANSWERS" : "SINGLE ANSWER"}</small>
          <strong>{poll.question}</strong>
        </div>
        <span className={`poll-state${closed ? " closed" : ""}`}>
          {closed ? <Lock size={11} /> : <span className="poll-live-dot" />}
          {closed ? "Closed" : "Open"}
        </span>
      </div>
      <p className="poll-instruction">
        {closed ? "Voting has ended. The final results are below." : poll.multi ? "Choose one or more answers. You can change your vote." : "Choose one answer. You can change your vote."}
      </p>
      <div className="poll-options" role={poll.multi ? "group" : "radiogroup"} aria-label="Poll answers">
        {counts.map((o) => {
          const share = pollPercentage(o.votes, total);
          const selected = mine.has(o.id);
          return (
            <button
              key={o.id}
              className={`poll-option${closed && top > 0 && o.votes === top ? " leading" : ""}`}
              role={poll.multi ? "checkbox" : "radio"}
              aria-checked={selected}
              disabled={closed || !canPost || busy}
              onClick={() => choose(o.id)}
              aria-label={`${o.text}, ${o.votes} ${o.votes === 1 ? "vote" : "votes"}, ${share}% of voters`}
            >
              <span className="poll-fill" style={{ width: `${share}%` }} aria-hidden="true" />
              <span className={`poll-mark${poll.multi ? " multi" : ""}`} aria-hidden="true">
                {selected && <Check size={11} />}
              </span>
              <span className="poll-answer">
                {o.emoji ? `${o.emoji} ` : ""}
                {o.text}
              </span>
              <span className="poll-option-stats">
                <span className="poll-count">{o.votes}</span>
                <span className="poll-percent">{share}%</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="poll-summary">
        <span>
          <UsersRound size={14} />
          {total} {total === 1 ? "person voted" : "people voted"}
        </span>
        <button className="poll-results-link" onClick={() => setResults(true)}>
          View votes
        </button>
      </div>
      {poll.multi && total > 0 && <p className="poll-multi-note">Percentages are of voters. Multiple answers can total over 100%.</p>}
      {!closed && canPost && (
        <div className="poll-privacy">
          <EyeOff size={15} aria-hidden="true" />
          <span className="lines">
            <strong>Vote anonymously</strong>
            <small>Hide your name in poll results</small>
          </span>
          <Toggle
            label="Vote anonymously"
            checked={anonymous}
            disabled={busy}
            onChange={(hidden) => {
              setAnonymous(hidden);
              if (mine.size) void submit([...mine], hidden);
            }}
          />
        </div>
      )}
      <div className="poll-foot">
        <span className="poll-deadline" title={poll.endsAt ? new Date(poll.endsAt).toLocaleString() : undefined}>
          {closed ? (
            <>
              <Lock size={12} />
              Voting closed
            </>
          ) : deadline ? (
            <>
              <Clock3 size={12} />
              {deadline}
            </>
          ) : (
            "No closing time"
          )}
        </span>
        <span className="poll-actions">
          {mine.size > 0 && !closed && canPost && (
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void submit([])}>
              Remove my vote
            </button>
          )}
          {m.outgoing && !closed && canPost && (
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setClosing(true)}>
              Close poll
            </button>
          )}
        </span>
      </div>
      {error && (
        <p className="poll-error" role="alert">
          {error}
        </p>
      )}
      {results && <PollResultsDialog rich={rich} onClose={() => setResults(false)} />}
      {closing && (
        <Dialog
          title="Close this poll?"
          onClose={() => !busy && setClosing(false)}
          footer={
            <>
              <button className="btn btn-secondary" disabled={busy} onClick={() => setClosing(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" disabled={busy} onClick={() => void close()}>
                {busy ? "Closing…" : "Close poll"}
              </button>
            </>
          }
        >
          <div className="dialog-body">
            <p>Voting will end for everyone. The results and voter list will remain available.</p>
          </div>
        </Dialog>
      )}
    </div>
  );
}
