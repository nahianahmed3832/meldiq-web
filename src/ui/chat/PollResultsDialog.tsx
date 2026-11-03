import { countLabel } from "../../i18n/counts";
import { formatUiNumber } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { EyeOff, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import type { RichContent } from "../../model/types";
import { pollVoterList, tally, voters } from "../../sync/polls";
import { UserAvatar } from "../components/OrgAvatar";
import { Dialog } from "../components/Overlay";
export function PollResultsDialog({ rich, onClose }: { rich: RichContent; onClose: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const users = useOrbit((s) => s.users);
  const me = useOrbit((s) => s.me);
  const [option, setOption] = useState("");
  const [shown, setShown] = useState(50);
  const rows = pollVoterList(rich, (id) => (id === me?.userId ? me.displayName : (users[id]?.displayName ?? uiText("workspace.interface.member_7c968fb"))), option || null);
  const visible = rows.slice(0, shown);
  const missing = visible.flatMap((r) => (r.userId && !users[r.userId] ? [r.userId] : [])).join("\n");
  useEffect(() => {
    for (const id of missing.split("\n").filter(Boolean)) void engine.ensureUser(id).catch(() => undefined);
  }, [engine, missing]);
  return (
    <Dialog
      title={uiText("messaging.interface.poll_votes_990b20a")}
      onClose={onClose}
      footer={
        <button className="btn btn-secondary" onClick={onClose}>
          {l10n("common.actions.done")}
        </button>
      }
    >
      <div className="dialog-body poll-results">
        <strong className="poll-results-question">{rich.poll?.question}</strong>
        <p className="poll-results-summary">
          <UsersRound size={15} /> {countLabel(voters(rich), "peopleVoted")}
        </p>
        <label className="field">
          <span>
            <Localized k="messaging.interface.show_voters_for_a68afc6" />
          </span>
          <select
            className="input"
            value={option}
            onChange={(e) => {
              setOption(e.target.value);
              setShown(50);
            }}
          >
            <option value="">
              <Localized k="messaging.interface.all_answers_a498f11" />
            </option>
            {tally(rich).map((o) => (
              <option key={o.id} value={o.id}>
                {o.text} ({formatUiNumber(o.votes)})
              </option>
            ))}
          </select>
        </label>
        <ul className="poll-voter-list" aria-label={uiText("messaging.interface.people_who_voted_6371c50")}>
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
        {!rows.length && (
          <p className="poll-empty">{option ? uiText("messaging.interface.nobody_has_voted_for_this_answer_yet_78bc1aa") : uiText("messaging.interface.no_votes_yet_be_the_first_to_vote_2fdabef")}</p>
        )}
        {rows.length > shown && (
          <button className="btn btn-secondary btn-sm" onClick={() => setShown((n) => n + 50)}>
            <Localized k="messaging.interface.show_more_voters_deb3323" slots={[rows.length - shown]} />
          </button>
        )}
        <p className="hint">
          <Localized k="messaging.interface.hidden_name_ballots_appear_as_anonymous_voter_5c0a79e" slots={[<EyeOff size={13} />]} />
        </p>
        {rich.poll?.multi && (
          <p className="hint">
            <Localized k="messaging.interface.each_person_counts_once_they_may_choose_more_than_one_answer_0a23a19" />
          </p>
        )}
      </div>
    </Dialog>
  );
}
