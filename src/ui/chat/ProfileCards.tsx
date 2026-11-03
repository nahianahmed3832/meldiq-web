import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { CircleUserRound, Search } from "lucide-react";
import { openProfile } from "../people/ProfileDialog";
import { useMemo, useState } from "react";
import { useOrbit } from "../../application/orbit";
import type { ContactCard } from "../../protocol/payload";
import { profileCard } from "../../sync/rich";
import { UserAvatar } from "../components/OrgAvatar";
import { Dialog } from "../components/Overlay";
/**
 * Share a Meldiq profile (android round 7 ProfileShareSheet, replacing typed contact cards): yours, or someone you
 * already talk to. The card carries the display name, user id and username only, never a phone number.
 */
export function ProfileShareDialog({ onSend, onClose }: { onSend: (c: ContactCard) => void; onClose: () => void }) {
  useLocaleRender();
  const me = useOrbit((s) => s.me);
  const users = useOrbit((s) => s.users);
  const [q, setQ] = useState("");
  const people = useMemo(() => {
    const term = q.trim().toLowerCase();
    return Object.values(users)
      .filter((u) => u.id !== me?.userId && (!term || u.displayName.toLowerCase().includes(term) || u.username.toLowerCase().includes(term)))
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
      .slice(0, 50);
  }, [users, me, q]);
  const send = (id: string, name: string, username: string) => {
    const card = profileCard(id, name, username);
    if (card) onSend(card);
  };
  return (
    <Dialog title={uiText("messaging.interface.share_a_profile_4025f02")} onClose={onClose}>
      <div className="dialog-body">
        <p className="faint" style={{ margin: "0 0 10px", fontSize: 13 }}>
          <Localized k="messaging.interface.sends_a_meldiq_profile_card_name_and_username_only_no_phone_numbe_88da87f" />
        </p>
        <div className="search-input" style={{ marginBottom: 8 }}>
          <Search size={16} className="faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={uiText("messaging.interface.search_people_8a7e7f1")}
            aria-label={uiText("messaging.interface.search_people_8a7e7f1")}
            autoFocus
          />
        </div>
        <ul className="profile-picker">
          {me && !q.trim() && (
            <li>
              <button className="list-row" onClick={() => send(me.userId, me.displayName, me.username)}>
                <UserAvatar userId={me.userId} name={me.displayName} colorIndex={me.avatarColor} photoRev={users[me.userId]?.photoRev} size={32} decorative />
                <span className="lines">
                  <strong>
                    <Localized k="messaging.interface.my_profile_271c62f" />
                  </strong>
                  <small>@{me.username}</small>
                </span>
              </button>
            </li>
          )}
          {people.map((u) => (
            <li key={u.id}>
              <button className="list-row" onClick={() => send(u.id, u.displayName, u.username)} aria-label={uiText("messaging.interface.share_value0_24c8374", { value0: u.displayName })}>
                <UserAvatar userId={u.id} name={u.displayName} colorIndex={u.avatarColor} photoRev={u.photoRev} size={32} decorative />
                <span className="lines">
                  <strong>{u.displayName}</strong>
                  <small>@{u.username}</small>
                </span>
              </button>
            </li>
          ))}
          {people.length === 0 && q.trim() && (
            <li className="faint">
              <Localized k="messaging.interface.no_one_matches_you_can_share_people_you_already_talk_to_on_meldiq_544acfb" />
            </li>
          )}
        </ul>
      </div>
    </Dialog>
  );
}
/** A received or sent profile card (android ProfileCardView): name, @username and View profile. No phone number, ever. */
export function ProfileCardView({ card }: { card: ContactCard }) {
  useLocaleRender();
  if (!card.userId) return null;
  return (
    <div className="profile-card">
      <CircleUserRound size={30} aria-hidden="true" className="faint" />
      <span className="lines">
        <strong>{card.name}</strong>
        {card.username && <small>@{card.username}</small>}
        <small className="faint">
          <Localized k="messaging.interface.meldiq_profile_e0de8c8" />
        </small>
      </span>
      <button className="btn btn-secondary btn-sm" onClick={() => openProfile(card.userId!, card.name)}>
        <Localized k="messaging.interface.view_profile_d4788f2" />
      </button>
    </div>
  );
}
