import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { UserPlus } from "lucide-react";
import type { Engine } from "../../sync/engine";
import { connect, suggestedPeople } from "../../sync/social";
import { useLoad } from "../workspace/useLoad";
import { FriendRow, Group } from "./FriendRows";
interface SuggestedPeopleProps {
  engine: Engine;
  /** Changes when connections change, so someone just added leaves the list. */
  rev: number;
  busy: boolean;
  online: Record<string, boolean>;
  match: (p: { displayName: string; username: string }) => boolean;
  run: (fn: () => Promise<unknown>, ok?: string) => void;
  onMessage: (userId: string) => void;
}
const communities = (n: number) => (n === 1 ? uiText("workspace.interface.1_community_in_common_cdc95ee") : uiText("workspace.interface.value0_communities_in_common_d48536e", { value0: n }));
/**
 * Friends › Suggested on servers with suggestions (API 0.65.0, GET /v2/people/suggested): up to 20 people who share a
 * community with you and turned "suggest me" on, most shared communities first. The server leaves out friends, pending
 * requests and blocked people.
 */
export function SuggestedPeople({ engine, rev, busy, online, match, run, onMessage }: SuggestedPeopleProps) {
  useLocaleRender();
  const l10n = useLocalization();
  const list = useLoad(() => suggestedPeople(engine), [engine, rev]);
  if (list.error && !list.data)
    return (
      <div className="banner danger" role="alert">
        <Localized k="workspace.interface.suggestions_couldn_t_be_loaded_fada06f" slots={[list.error]} />
        <button className="btn btn-secondary btn-sm" onClick={list.reload}>
          {l10n("common.actions.retry")}
        </button>
      </div>
    );
  if (!list.data) return <p className="faint">{l10n("common.status.loading")}</p>;
  const people = list.data.filter((s) => match(s.user));
  return (
    <Group
      title={uiText("workspace.interface.people_you_may_know_value0_38b6a8f", { value0: people.length })}
      empty={uiText("workspace.interface.no_suggestions_yet_people_who_share_communities_with_you_and_0f6d12d")}
    >
      {people.map(({ user, sharedCommunities }) => (
        <FriendRow
          key={user.id}
          p={user}
          online={!!online[user.id]}
          sub={communities(sharedCommunities)}
          onMessage={() => onMessage(user.id)}
          actions={
            <button
              className="btn btn-secondary btn-sm"
              disabled={busy}
              onClick={() => run(() => connect(engine, { userId: user.id }), uiText("workspace.interface.friend_request_sent_to_value0_65eed36", { value0: user.displayName }))}
            >
              <Localized k="workspace.interface.add_friend_1c450cd" slots={[<UserPlus size={14} aria-hidden="true" />]} />
            </button>
          }
        />
      ))}
    </Group>
  );
}
