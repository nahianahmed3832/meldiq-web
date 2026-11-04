import { countLabel } from "../../i18n/counts";
import { formatUiNumber } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { interfaceLocale } from "../../i18n/format";
import { useT as useLocalization } from "../../i18n";
import { BarChart3, Check, Clock3, EyeOff, Lock, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useEngine } from "../../application/orbit";
import type { StoredMessage } from "../../model/types";
import { pollClosed, pollPercentage, tally, voters } from "../../sync/polls";
import { Dialog } from "../components/Overlay";
import { Toggle } from "../components/Toggle";
import type { ManagedPollState } from "../../sync/managedPolls";
import { PollResultsDialog } from "./PollResultsDialog";
/** A live poll with explicit counts, percent of voters and per-ballot name visibility. */
export function PollView({
  m,
  myUserId,
  canPost,
  managed,
}: {
  m: StoredMessage;
  myUserId: string;
  canPost: boolean;
  managed?: { state: ManagedPollState; vote: (choices: string[], anonymous: boolean) => Promise<void>; close: () => Promise<void> };
}) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const [now, setNow] = useState(Date.now);
  const [results, setResults] = useState(false);
  const [closing, setClosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anonymous, setAnonymous] = useState(m.rich?.votePrivacy?.[myUserId] === true);
  const rich = m.rich;
  const poll = rich?.poll;
  const myVisibility = managed ? (managed.state.mine?.anonymous ?? null) : rich?.votes?.[myUserId]?.length ? rich.votePrivacy?.[myUserId] === true : null;
  useEffect(() => {
    if (myVisibility !== null) setAnonymous(myVisibility);
  }, [m.id, myVisibility]);
  useEffect(() => {
    if (!poll?.endsAt || rich?.pollClosed || now >= poll.endsAt) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(25, Math.min(60000, poll.endsAt - now + 25)));
    return () => clearTimeout(timer);
  }, [poll?.endsAt, rich?.pollClosed, now]);
  if (!rich || !poll) return null;
  const counts = managed ? poll.options.map((o) => ({ ...o, votes: managed.state.counts.find((c) => c.id === o.id)?.votes ?? 0 })) : tally(rich);
  const total = managed?.state.total ?? voters(rich);
  const mine = new Set(managed ? (managed.state.mine?.choices ?? []) : (rich.votes?.[myUserId] ?? []));
  const closed = managed ? managed.state.closed : pollClosed(rich, now);
  const top = Math.max(0, ...counts.map((o) => o.votes));
  const submit = async (choices: string[], hidden = anonymous) => {
    if (closed || !canPost || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (managed) await managed.vote(choices, hidden);
      else await engine.vote(m, choices, hidden);
    } catch (e) {
      setError(e instanceof Error ? e.message : uiText("messaging.interface.couldn_t_save_your_vote_try_again_dd978a6"));
    } finally {
      setBusy(false);
    }
  };
  const choose = (id: string) => void submit(poll.multi ? (mine.has(id) ? [...mine].filter((x) => x !== id) : [...mine, id]) : mine.has(id) ? [] : [id]);
  const close = async () => {
    setBusy(true);
    setError(null);
    try {
      if (managed) await managed.close();
      else await engine.closePoll(m);
      setClosing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : uiText("messaging.interface.couldn_t_close_this_poll_try_again_76173e3"));
      setClosing(false);
    } finally {
      setBusy(false);
    }
  };
  const remaining = poll.endsAt ? Math.max(1, Math.ceil((poll.endsAt - now) / 60000)) : null;
  const deadline = remaining
    ? remaining >= 60
      ? uiText("messaging.interface.ends_in_value0_h_cd7d61d", { value0: Math.ceil(remaining / 60) })
      : uiText("messaging.interface.ends_in_value0_m_e03094a", { value0: remaining })
    : "";
  return (
    <div className={`poll${closed ? " is-closed" : ""}`} role="group" aria-label={uiText("messaging.interface.poll_value0_263ee4e", { value0: poll.question })} aria-busy={busy}>
      <div className="poll-head">
        <span className="poll-symbol">
          <BarChart3 size={19} aria-hidden="true" />
        </span>
        <div className="poll-heading">
          <small>
            <Localized k="messaging.interface.poll_c78db8a" slots={[poll.multi ? uiText("messaging.interface.multiple_answers_e4b5b74") : uiText("messaging.interface.single_answer_4e0f54b")]} />
          </small>
          <strong>{poll.question}</strong>
        </div>
        <span className={`poll-state${closed ? " closed" : ""}`}>
          {closed ? <Lock size={11} /> : <span className="poll-live-dot" />}
          {closed ? uiText("messaging.interface.closed_c21ead0") : l10n("workspace.discover_open_btn")}
        </span>
      </div>
      <p className="poll-instruction">
        {closed
          ? uiText("messaging.interface.voting_has_ended_the_final_results_are_below_eebbde8")
          : poll.multi
            ? uiText("messaging.interface.choose_one_or_more_answers_you_can_change_your_vote_3951f15")
            : uiText("messaging.interface.choose_one_answer_you_can_change_your_vote_9376744")}
      </p>
      {managed?.state.poll.quiz && !closed && <p className="hint">{uiText("workspace.part3.quizReveal")}</p>}
      <div className="poll-options" role={poll.multi ? "group" : "radiogroup"} aria-label={uiText("messaging.interface.poll_answers_bde2d20")}>
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
              aria-label={uiText("messaging.interface.native_count_1ce5b31dc", {
                value0: o.text + (closed && managed?.state.correctOptionIds?.includes(o.id) ? `, ${uiText("workspace.part3.correctAnswer")}` : ""),
                value1: countLabel(o.votes, "votes"),
                value2: "",
                value3: share,
              })}
            >
              <span className="poll-fill" style={{ width: `${share}%` }} aria-hidden="true" />
              <span className={`poll-mark${poll.multi ? " multi" : ""}`} aria-hidden="true">
                {selected && <Check size={11} />}
              </span>
              <span className="poll-answer">
                {o.emoji ? uiText("messaging.interface.value0_f77463c", { value0: o.emoji }) : ""}
                {o.text}
                {closed && managed?.state.correctOptionIds?.includes(o.id) && (
                  <span className="tag">
                    <Check size={12} aria-hidden="true" />
                    {uiText("workspace.part3.correctAnswer")}
                  </span>
                )}
              </span>
              <span className="poll-option-stats">
                <span className="poll-count">{formatUiNumber(o.votes)}</span>
                <span className="poll-percent">{formatUiNumber(share)}%</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="poll-summary">
        <span>
          <UsersRound size={14} />
          {countLabel(total, "peopleVoted")}
        </span>
        <button className="poll-results-link" onClick={() => setResults(true)}>
          <Localized k="messaging.interface.view_votes_6f800b6" />
        </button>
      </div>
      {poll.multi && total > 0 && (
        <p className="poll-multi-note">
          <Localized k="messaging.interface.percentages_are_of_voters_multiple_answers_can_total_over_100_e4b8830" />
        </p>
      )}
      {!closed && canPost && (
        <div className="poll-privacy">
          <EyeOff size={15} aria-hidden="true" />
          <span className="lines">
            <strong>
              <Localized k="messaging.interface.vote_anonymously_4c0479f" />
            </strong>
            <small>
              <Localized k="messaging.interface.hide_your_name_in_poll_results_49735ae" />
            </small>
          </span>
          <Toggle
            label={uiText("messaging.interface.vote_anonymously_4c0479f")}
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
        <span className="poll-deadline" title={poll.endsAt ? new Date(poll.endsAt).toLocaleString(interfaceLocale()) : undefined}>
          {closed ? (
            <>
              <Localized k="messaging.interface.voting_closed_1865ef1" slots={[<Lock size={12} />]} />
            </>
          ) : deadline ? (
            <>
              <Clock3 size={12} />
              {deadline}
            </>
          ) : (
            uiText("messaging.interface.no_closing_time_f8df6f0")
          )}
        </span>
        <span className="poll-actions">
          {mine.size > 0 && !closed && canPost && (
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void submit([])}>
              <Localized k="messaging.interface.remove_my_vote_0503498" />
            </button>
          )}
          {(managed ? managed.state.canClose : m.outgoing) && !closed && canPost && (
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setClosing(true)}>
              <Localized k="messaging.interface.close_poll_f6740d6" />
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
          title={uiText("messaging.interface.close_this_poll_842dfae")}
          onClose={() => !busy && setClosing(false)}
          footer={
            <>
              <button className="btn btn-secondary" disabled={busy} onClick={() => setClosing(false)}>
                {l10n("common.actions.cancel")}
              </button>
              <button className="btn btn-primary" disabled={busy} onClick={() => void close()}>
                {busy ? uiText("messaging.interface.closing_abdb0cf") : uiText("messaging.interface.close_poll_f6740d6")}
              </button>
            </>
          }
        >
          <div className="dialog-body">
            <p>
              <Localized k="messaging.interface.voting_will_end_for_everyone_the_results_and_voter_list_will_rema_6dbd311" />
            </p>
          </div>
        </Dialog>
      )}
    </div>
  );
}
