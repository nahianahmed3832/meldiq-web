import { EyeOff, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import type { RichContent } from "../../model/types";
import { pollVoterList, tally, voters } from "../../sync/polls";
import { UserAvatar } from "../components/OrgAvatar";
import { Dialog } from "../components/Overlay";

export function PollResultsDialog({ rich, onClose }: { rich: RichContent; onClose: () => void }) {
  const engine = useEngine();
  const users = useOrbit((s) => s.users);
  const me = useOrbit((s) => s.me);
  const [option, setOption] = useState("");
  const [shown, setShown] = useState(50);
  const rows = pollVoterList(rich, (id) => (id === me?.userId ? me.displayName : (users[id]?.displayName ?? "Member")), option || null);
  const visible = rows.slice(0, shown);
  const missing = visible.flatMap((r) => (r.userId && !users[r.userId] ? [r.userId] : [])).join("\n");
  useEffect(() => {
    for (const id of missing.split("\n").filter(Boolean)) void engine.ensureUser(id).catch(() => undefined);
  }, [engine, missing]);
  return (
    <Dialog
      title="Poll votes"
      onClose={onClose}
      footer={
        <button className="btn btn-secondary" onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="dialog-body poll-results">
        <strong className="poll-results-question">{rich.poll?.question}</strong>
        <p className="poll-results-summary">
          <UsersRound size={15} /> {voters(rich)} {voters(rich) === 1 ? "person voted" : "people voted"}
        </p>
        <label className="field">
          <span>Show voters for</span>
          <select
            className="input"
            value={option}
            onChange={(e) => {
              setOption(e.target.value);
              setShown(50);
            }}
          >
            <option value="">All answers</option>
            {tally(rich).map((o) => (
              <option key={o.id} value={o.id}>
                {o.text} ({o.votes})
              </option>
            ))}
          </select>
        </label>
        <ul className="poll-voter-list" aria-label="People who voted">
          {visible.map((v) => (
            <li key={v.key} className={v.anonymous ? "poll-voter anonymous" : "poll-voter"}>
              {v.userId ? (
                <UserAvatar userId={v.userId} name={v.name} colorIndex={users[v.userId]?.avatarColor ?? 0} photoRev={users[v.userId]?.photoRev} size={34} decorative />
              ) : (
                <span className="poll-anonymous-avatar" aria-hidden="true">
                  <EyeOff size={16} />
                </span>
              )}
              <span className="lines">
                <strong>{v.name}</strong>
                <small>{v.choices.join(" · ")}</small>
              </span>
            </li>
          ))}
        </ul>
        {!rows.length && <p className="poll-empty">{option ? "Nobody has voted for this answer yet." : "No votes yet. Be the first to vote."}</p>}
        {rows.length > shown && (
          <button className="btn btn-secondary btn-sm" onClick={() => setShown((n) => n + 50)}>
            Show more voters ({rows.length - shown})
          </button>
        )}
        <p className="hint">
          <EyeOff size={13} /> Hidden-name ballots appear as Anonymous voter.
        </p>
        {rich.poll?.multi && <p className="hint">Each person counts once. They may choose more than one answer.</p>}
      </div>
    </Dialog>
  );
}
