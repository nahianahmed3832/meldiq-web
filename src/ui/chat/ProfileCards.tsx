import { CircleUserRound, MessageSquare, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../../api/client";
import { useEngine, useOrbit } from "../../app/orbit";
import { navigate } from "../../app/router";
import type { ContactCard } from "../../protocol/payload";
import { startDirect, userProfile } from "../../sync/account";
import { profileCard } from "../../sync/rich";
import { UserAvatar } from "../components/OrgAvatar";
import { Dialog } from "../components/Overlay";

/**
 * Share a Meldiq profile (android round 7 ProfileShareSheet, replacing typed contact cards): yours, or someone you
 * already talk to. The card carries the display name, user id and username only, never a phone number.
 */
export function ProfileShareDialog({ onSend, onClose }: { onSend: (c: ContactCard) => void; onClose: () => void }) {
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
    <Dialog title="Share a profile" onClose={onClose}>
      <div className="dialog-body">
        <p className="faint" style={{ margin: "0 0 10px", fontSize: 13 }}>
          Sends a Meldiq profile card: name and username only. No phone number is shared.
        </p>
        <div className="search-input" style={{ marginBottom: 8 }}>
          <Search size={16} className="faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" aria-label="Search people" autoFocus />
        </div>
        <ul className="profile-picker">
          {me && !q.trim() && (
            <li>
              <button className="list-row" onClick={() => send(me.userId, me.displayName, me.username)}>
                <UserAvatar userId={me.userId} name={me.displayName} colorIndex={me.avatarColor} photoRev={users[me.userId]?.photoRev} size={32} decorative />
                <span className="lines">
                  <strong>My profile</strong>
                  <small>@{me.username}</small>
                </span>
              </button>
            </li>
          )}
          {people.map((u) => (
            <li key={u.id}>
              <button className="list-row" onClick={() => send(u.id, u.displayName, u.username)} aria-label={`Share ${u.displayName}`}>
                <UserAvatar userId={u.id} name={u.displayName} colorIndex={u.avatarColor} photoRev={u.photoRev} size={32} decorative />
                <span className="lines">
                  <strong>{u.displayName}</strong>
                  <small>@{u.username}</small>
                </span>
              </button>
            </li>
          ))}
          {people.length === 0 && q.trim() && <li className="faint">No one matches. You can share people you already talk to on Meldiq.</li>}
        </ul>
      </div>
    </Dialog>
  );
}

/** A received or sent profile card (android ProfileCardView): name, @username and View profile. No phone number, ever. */
export function ProfileCardView({ card }: { card: ContactCard }) {
  const [open, setOpen] = useState(false);
  if (!card.userId) return null;
  return (
    <div className="profile-card">
      <CircleUserRound size={30} aria-hidden="true" className="faint" />
      <span className="lines">
        <strong>{card.name}</strong>
        {card.username && <small>@{card.username}</small>}
        <small className="faint">Meldiq profile</small>
      </span>
      <button className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>
        View profile
      </button>
      {open && <ProfileDialog userId={card.userId} fallbackName={card.name} onClose={() => setOpen(false)} />}
    </div>
  );
}

type Profile = Awaited<ReturnType<typeof userProfile>>;

/** Someone's profile as the server lets this account see it (its privacy rules apply), with Message. */
function ProfileDialog({ userId, fallbackName, onClose }: { userId: string; fallbackName: string; onClose: () => void }) {
  const engine = useEngine();
  const me = useOrbit((s) => s.me?.userId);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    userProfile(engine, userId)
      .then((p) => alive && setProfile(p))
      .catch(
        (e: unknown) =>
          alive && setError(e instanceof ApiError && (e.status === 404 || e.status === 403) ? "This profile isn't available to you." : e instanceof Error ? e.message : "Couldn't load this profile."),
      );
    return () => {
      alive = false;
    };
  }, [engine, userId]);
  const message = () =>
    void startDirect(engine, userId)
      .then((id) => {
        onClose();
        navigate({ section: "dms", conversationId: id });
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't open the conversation."));
  return (
    <Dialog
      title={profile?.displayName ?? fallbackName}
      onClose={onClose}
      footer={
        profile && userId !== me ? (
          <button className="btn btn-primary" onClick={message}>
            <MessageSquare size={16} /> Message
          </button>
        ) : undefined
      }
    >
      <div className="dialog-body profile-dialog">
        {error ? (
          <p className="faint">{error}</p>
        ) : !profile ? (
          <div className="skeleton" style={{ height: 64 }} aria-busy="true" />
        ) : (
          <div className="row" style={{ gap: 14 }}>
            <UserAvatar userId={profile.id} name={profile.displayName} colorIndex={profile.avatarColor} photoRev={profile.photoRev} size={56} decorative />
            <span className="lines">
              <strong>{profile.displayName}</strong>
              <small>@{profile.username}</small>
              {profile.statusText && <small className="faint">{profile.statusText}</small>}
            </span>
          </div>
        )}
      </div>
    </Dialog>
  );
}
