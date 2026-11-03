import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { Check, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../../api/client";
import { shallowEqual, useEngine, useOrbit } from "../../application/orbit";
import { searchPeople } from "../../sync/account";
import { type AddOutcome, addMembers } from "../../sync/addMembers";
import { UserAvatar } from "../components/OrgAvatar";
import { Dialog } from "../components/Overlay";
import { dmPeer } from "../format";
import { QuickInvite } from "./InviteLink";
import { StandardInvite } from "./StandardInvite";
import { PARITY_FEATURES } from "../../sync/communityParity";
interface AddMembersDialogProps {
  orgId: string;
  orgName: string;
  onClose: () => void;
  onAdded: () => void;
}
interface Person {
  id: string;
  displayName: string;
  username: string;
  avatarColor: number;
  photoRev?: number | null;
}
/** Waits this long after typing stops before searching. */
const SEARCH_DELAY_MS = 300;
const MIN_QUERY = 2;
/**
 * Invite friends (community-first brief §F, the reference's "Invite friends to …"): the people you message, or anyone
 * found as you type, each with its own Invite; then an invitation link to send yourself. The server decides who can be
 * added directly (people you know who'd accept a message from you); anyone else is pointed at the link. Search shows only
 * who the server's privacy rules let you find.
 */
export function AddMembersDialog({ orgId, orgName, onClose, onAdded }: AddMembersDialogProps) {
  useLocaleRender();
  const engine = useEngine();
  const me = useOrbit((s) => s.me?.userId ?? "");
  // Community parity A3: a never-expiring link of your own, instead of making one on the spot.
  const standard = useOrbit((s) => s.server?.features.includes(PARITY_FEATURES.settings) ?? false);
  const conversations = useOrbit((s) => s.conversations, shallowEqual);
  const users = useOrbit((s) => s.users);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Person[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [outcomes, setOutcomes] = useState<Record<string, AddOutcome | "adding">>({});
  const [error, setError] = useState<string | null>(null);
  // The people you message, most recent first: the reference's list before anything is typed.
  const contacts = useMemo(() => {
    const seen = new Set<string>();
    return Object.values(conversations)
      .filter((c) => c.type === "DM")
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((c) => dmPeer(c, me))
      .filter((p): p is NonNullable<typeof p> => !!p && !seen.has(p.id) && !!seen.add(p.id))
      .map((p) => ({ ...p, displayName: users[p.id]?.displayName ?? p.displayName, photoRev: users[p.id]?.photoRev ?? null }));
  }, [conversations, users, me]);
  const term = q.trim();
  useEffect(() => {
    if (term.length < MIN_QUERY) {
      setFound(null);
      return;
    }
    let alive = true;
    setSearching(true);
    const timer = setTimeout(() => {
      searchPeople(engine, term)
        .then((r) => alive && setFound(r.filter((m) => m.id !== me)))
        .catch((e: unknown) => alive && setError(errorText(e, uiText("workspace.interface.couldn_t_search_right_now_5cf0374"))))
        .finally(() => alive && setSearching(false));
    }, SEARCH_DELAY_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [engine, term, me]);
  const invite = async (p: Person) => {
    setError(null);
    setOutcomes((o) => ({ ...o, [p.id]: "adding" }));
    try {
      const outcome = (await addMembers(engine, orgId, [p.id]))[0]?.outcome ?? "not_available";
      setOutcomes((o) => ({ ...o, [p.id]: outcome }));
      if (outcome === "added") onAdded();
    } catch (e) {
      setOutcomes(({ [p.id]: _, ...rest }) => rest);
      setError(errorText(e, uiText("workspace.interface.couldn_t_add_value0_try_again_0b3d481", { value0: p.displayName })));
    }
  };
  const list = found ?? contacts;
  return (
    <Dialog title={uiText("workspace.interface.invite_friends_to_value0_b0b2f79", { value0: orgName })} onClose={onClose} className="invite-dialog">
      <div className="dialog-body">
        <label className="search-input invite-search">
          <Search size={16} className="faint" aria-hidden="true" />
          <input
            data-autofocus
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={uiText("workspace.interface.search_for_friends_524b51e")}
            aria-label={uiText("workspace.interface.search_for_friends_524b51e")}
          />
        </label>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <ul className="invite-people" aria-label={found ? uiText("workspace.interface.people_found_29b8414") : uiText("workspace.interface.people_you_message_4659cc8")} aria-busy={searching}>
          {list.map((p) => (
            <InviteRow key={p.id} person={p} outcome={outcomes[p.id]} onInvite={() => void invite(p)} />
          ))}
          {list.length === 0 && (
            <li className="faint invite-empty">
              {found
                ? uiText("workspace.interface.no_one_found_try_their_exact_username_0323984")
                : searching
                  ? uiText("workspace.interface.searching_c31723a")
                  : uiText("workspace.interface.search_by_name_or_username_55c7518")}
            </li>
          )}
        </ul>
        <div className="invite-or" role="group" aria-labelledby="invite-or-title">
          <h3 id="invite-or-title" className="invite-or-title">
            <Localized k="workspace.interface.or_send_a_community_invite_link_to_a_friend_2bf6b81" />
          </h3>
          {standard ? <StandardInvite orgId={orgId} /> : <QuickInvite orgId={orgId} />}
        </div>
      </div>
    </Dialog>
  );
}
function InviteRow({ person: p, outcome, onInvite }: { person: Person; outcome: AddOutcome | "adding" | undefined; onInvite: () => void }) {
  useLocaleRender();
  return (
    <li className="invite-person">
      <UserAvatar userId={p.id} name={p.displayName} colorIndex={p.avatarColor} photoRev={p.photoRev ?? null} size={36} decorative />
      <span className="lines grow">
        <strong className="ellipsis">{p.displayName}</strong>
        <small className="ellipsis">@{p.username}</small>
      </span>
      {outcome === undefined || outcome === "adding" ? (
        <button className="btn btn-secondary btn-sm" disabled={outcome === "adding"} onClick={onInvite} aria-label={uiText("workspace.interface.invite_value0_ac7f88e", { value0: p.displayName })}>
          {outcome === "adding" ? uiText("messaging.interface.adding_c6de6f4") : uiText("workspace.interface.invite_1fd9ae1")}
        </button>
      ) : (
        <span className={outcome === "added" ? "tag ok" : "faint invite-outcome"} role="status">
          {outcome === "added" && <Check size={12} aria-hidden="true" />}
          {OUTCOME_TEXT[outcome]}
        </span>
      )}
    </li>
  );
}
const errorText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);
const OUTCOME_TEXT: Record<AddOutcome, string> = {
  get added() {
    return uiText("messaging.interface.added_6b02e0d");
  },
  get already_member() {
    return uiText("workspace.interface.already_a_member_1739ed7");
  },
  get not_available() {
    return uiText("workspace.interface.send_them_the_link_below_3b89f27");
  },
};
