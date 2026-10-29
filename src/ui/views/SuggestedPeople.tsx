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

const communities = (n: number) => (n === 1 ? "1 community in common" : `${n} communities in common`);

/**
 * Friends › Suggested on servers with suggestions (API 0.65.0, GET /v2/people/suggested): up to 20 people who share a
 * community with you and turned "suggest me" on, most shared communities first. The server leaves out friends, pending
 * requests and blocked people.
 */
export function SuggestedPeople({ engine, rev, busy, online, match, run, onMessage }: SuggestedPeopleProps) {
  const list = useLoad(() => suggestedPeople(engine), [engine, rev]);
  if (list.error && !list.data) return <div className="banner danger">Suggestions couldn't be loaded. {list.error}</div>;
  if (!list.data) return <p className="faint">Loading…</p>;
  const people = list.data.filter((s) => match(s.user));
  return (
    <Group title={`People you may know — ${people.length}`} empty="No suggestions yet. People who share communities with you and let themselves be suggested show here.">
      {people.map(({ user, sharedCommunities }) => (
        <FriendRow
          key={user.id}
          p={user}
          online={!!online[user.id]}
          sub={communities(sharedCommunities)}
          onMessage={() => onMessage(user.id)}
          actions={
            <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => run(() => connect(engine, { userId: user.id }), `Friend request sent to ${user.displayName}.`)}>
              <UserPlus size={14} aria-hidden="true" /> Add friend
            </button>
          }
        />
      ))}
    </Group>
  );
}
