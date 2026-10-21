import { BarChart3, Lock } from "lucide-react";
import { useEngine } from "../../app/orbit";
import type { StoredMessage } from "../../model/types";
import { pollClosed, tally, voters } from "../../sync/polls";

/**
 * A poll in a message (android RichViews poll card): each option with its count and share, this person's choice marked,
 * and a vote that replaces their earlier one. Votes are end-to-end encrypted controls; nobody but the people here sees
 * who voted for what. Its creator can close it.
 */
export function PollView({ m, myUserId, canPost }: { m: StoredMessage; myUserId: string; canPost: boolean }) {
  const engine = useEngine();
  const rich = m.rich;
  if (!rich?.poll) return null;
  const poll = rich.poll;
  const counts = tally(rich);
  const total = voters(rich);
  const mine = new Set(rich.votes?.[myUserId] ?? []);
  const closed = pollClosed(rich, Date.now());
  const choose = (id: string) => {
    if (closed || !canPost) return;
    const next = poll.multi ? (mine.has(id) ? [...mine].filter((x) => x !== id) : [...mine, id]) : mine.has(id) ? [] : [id];
    void engine.vote(m, next);
  };
  return (
    <div className="poll" role="group" aria-label={`Poll: ${poll.question}`}>
      <div className="poll-head">
        <BarChart3 size={16} aria-hidden="true" />
        <strong>{poll.question}</strong>
      </div>
      <div className="poll-options" role={poll.multi ? "group" : "radiogroup"}>
        {counts.map((o) => {
          const share = total ? Math.round((o.votes / total) * 100) : 0;
          return (
            <button
              key={o.id}
              className="poll-option"
              role={poll.multi ? "checkbox" : "radio"}
              aria-checked={mine.has(o.id)}
              disabled={closed || !canPost}
              onClick={() => choose(o.id)}
              aria-label={`${o.text}, ${o.votes} ${o.votes === 1 ? "vote" : "votes"}`}
            >
              <span className="poll-fill" style={{ width: `${share}%` }} aria-hidden="true" />
              <span className={`poll-mark${poll.multi ? " multi" : ""}`} aria-hidden="true" />
              <span className="grow ellipsis">
                {o.emoji ? `${o.emoji} ` : ""}
                {o.text}
              </span>
              <span className="poll-count">{o.votes}</span>
            </button>
          );
        })}
      </div>
      <div className="poll-foot">
        <span>
          {total} {total === 1 ? "person voted" : "people voted"}
          {poll.multi ? " · several answers allowed" : ""}
        </span>
        {closed ? (
          <span className="tag">
            <Lock size={11} /> Closed
          </span>
        ) : (
          m.outgoing &&
          canPost && (
            <button className="btn btn-ghost btn-sm" onClick={() => void engine.closePoll(m)}>
              Close poll
            </button>
          )
        )}
      </div>
    </div>
  );
}
