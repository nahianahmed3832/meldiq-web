import { CircleUserRound, UsersRound, X } from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Conversation, Member } from "../../api/schemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { setPrefs, usePrefs } from "../../application/prefs";
import { navigate, type Route } from "../../application/router";
import type { Engine } from "../../sync/engine";
import { userProfile } from "../../sync/account";
import { presenceWords } from "../../sync/social";
import { directory } from "../../sync/workspaces";
import { toneOf } from "../components/Avatar";
import { UserAvatar } from "../components/OrgAvatar";
import { dmPeer, relative } from "../format";
import { openProfile } from "../people/ProfileDialog";
import { useMembers } from "./ConversationDetails";
import { isHere, type ListedRole, memberListGroups, nameColor } from "./memberListRules";

/** Wide enough to keep a member list or profile beside the messages; narrower screens open them over the messages. */
const WIDE = "(min-width: 1241px)";
/** How long a community's roles are reused while moving between its channels. */
const ROLES_TTL_MS = 60_000;

export function useWideLayout(): boolean {
  return useSyncExternalStore(
    (l) => {
      const q = matchMedia(WIDE);
      q.addEventListener("change", l);
      return () => q.removeEventListener("change", l);
    },
    () => matchMedia(WIDE).matches,
    () => false,
  );
}

/** Whether a conversation can show people beside it: not a voice room, whose page already shows who's in it. */
export const hasPeoplePanel = (c: Pick<Conversation, "voice">): boolean => !c.voice;

/** Whether the member list (channels, groups) or profile (DMs) is beside this conversation now. */
export function usePeopleShown(c: Pick<Conversation, "type" | "voice">, route: Route): boolean {
  const prefs = usePrefs();
  const wide = useWideLayout();
  if (!hasPeoplePanel(c)) return false;
  if (route.panel === "members") return true;
  return !route.panel && wide && (c.type === "DM" ? prefs.dmProfile : prefs.memberList);
}

const rolesCache = new Map<string, { at: number; roles: Map<string, ListedRole[]> }>();

/** The community's custom roles per person, where this account may see the member directory; empty otherwise. */
function useCommunityRoles(engine: Engine, orgId: string | null): Map<string, ListedRole[]> {
  const cached = orgId ? rolesCache.get(orgId) : undefined;
  const [roles, setRoles] = useState(cached?.roles ?? new Map<string, ListedRole[]>());
  useEffect(() => {
    if (!orgId) return;
    const hit = rolesCache.get(orgId);
    if (hit && Date.now() - hit.at < ROLES_TTL_MS) return setRoles(hit.roles);
    let alive = true;
    directory(engine, orgId)
      .then((people) => {
        const next = new Map(people.map((p) => [p.id, p.customRoles]));
        rolesCache.set(orgId, { at: Date.now(), roles: next });
        if (alive) setRoles(next);
      })
      // Guests and roles without the member directory see the list without role groups.
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [engine, orgId]);
  return roles;
}

/** A channel's or group's members beside the messages, as Discord lists them: by role while here, then offline. */
export function MemberListPanel({ c, onClose }: { c: Conversation; onClose: () => void }) {
  const engine = useEngine();
  const users = useOrbit((s) => s.users);
  const { members, error } = useMembers(c.id, c.memberCount);
  const roles = useCommunityRoles(engine, c.type === "CHANNEL" ? c.orgId : null);
  // The store has the latest presence, names and photos (live updates); the member list has everyone.
  const people = useMemo(
    () =>
      (members ?? []).map((m) => {
        const u = users[m.id];
        return { ...m, displayName: u?.displayName ?? m.displayName, presence: u?.presence ?? m.presence, online: u?.online ?? m.online, photoRev: u?.photoRev ?? m.photoRev };
      }),
    [members, users],
  );
  const groups = useMemo(() => memberListGroups(people, (id) => roles.get(id)), [people, roles]);

  return (
    <aside className="panel member-list" aria-label="Members">
      <div className="member-list-head">
        <span className="grow">Members</span>
        <button className="icon-btn" onClick={onClose} aria-label="Hide the member list">
          <X size={16} />
        </button>
      </div>
      <div className="member-list-body scroll">
        {error && <p className="faint member-list-note">{error}</p>}
        {!members && !error && <div className="skeleton" style={{ height: 40, margin: "8px 12px" }} aria-busy="true" />}
        {groups.map((g) => (
          <section key={g.key} aria-label={`${g.label}, ${g.members.length}`}>
            <h3 className="member-group" style={g.color ? { color: g.color } : undefined}>
              {g.label} — {g.members.length}
            </h3>
            {g.members.map((m) => (
              <MemberRow key={m.id} m={m} away={!isHere(m)} color={nameColor(roles.get(m.id))} />
            ))}
          </section>
        ))}
      </div>
    </aside>
  );
}

function MemberRow({ m, away, color }: { m: Member; away: boolean; color: string | null }) {
  const status = [m.statusEmoji, m.statusText].filter(Boolean).join(" ");
  return (
    <button className={`member-row${away ? " away" : ""}`} onClick={() => openProfile(m.id, m.displayName)} aria-label={`${m.displayName}${away ? ", offline" : ""}: profile`}>
      <UserAvatar userId={m.id} name={m.displayName} colorIndex={m.avatarColor} photoRev={m.photoRev} size={34} online={away ? null : true} presence={away ? null : m.presence} decorative />
      <span className="lines">
        <span className="member-name ellipsis" style={color ? { color } : undefined}>
          {m.displayName}
        </span>
        {status && <small className="ellipsis">{status}</small>}
      </span>
    </button>
  );
}

type Profile = Awaited<ReturnType<typeof userProfile>>;

/** The other person in a direct message beside the messages (Discord's user profile): photo, names, status, presence. */
export function ProfilePanel({ c, onClose }: { c: Conversation; onClose: () => void }) {
  const engine = useEngine();
  const me = useOrbit((s) => s.me?.userId ?? "");
  const peer = dmPeer(c, me);
  const known = useOrbit((s) => (peer ? s.users[peer.id] : undefined));
  const peerId = peer?.id ?? null;
  const profilesRev = useOrbit((s) => s.profilesRev);
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => {
    if (!peerId) return;
    let alive = true;
    userProfile(engine, peerId)
      .then((p) => alive && setProfile(p))
      // Shown from what this browser already knows about them instead.
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [engine, peerId, profilesRev]);
  if (!peer) return null;
  const name = known?.displayName ?? profile?.displayName ?? peer.displayName;
  const presence = known?.presence ?? profile?.presence ?? null;
  const online = known?.online ?? profile?.online ?? null;
  const words = presenceWords(presence, online);
  const status = [known?.statusEmoji ?? profile?.statusEmoji, known?.statusText ?? profile?.statusText].filter(Boolean).join(" ");
  const pronouns = known?.pronouns ?? profile?.pronouns;
  const color = known?.avatarColor ?? peer.avatarColor;

  return (
    <aside className="panel profile-panel" aria-label={`${name}'s profile`}>
      <div className="profile-panel-scroll scroll">
        <div className="profile-banner" style={{ background: toneOf(color) }}>
          <button className="icon-btn" onClick={onClose} aria-label="Hide the profile">
            <X size={16} />
          </button>
        </div>
        <div className="profile-panel-body">
          <div className="profile-panel-avatar">
            <UserAvatar userId={peer.id} name={name} colorIndex={color} photoRev={known?.photoRev ?? profile?.photoRev} size={84} online={online} presence={presence} decorative />
          </div>
          <h2 className="ellipsis">{name}</h2>
          <p className="profile-handle">
            @{known?.username ?? peer.username}
            {pronouns ? ` · ${pronouns}` : ""}
          </p>
          {status && <p className="profile-status">{status}</p>}
          <div className="panel-card">
            <div>
              <dt>{words ? "Now" : "Last seen"}</dt>
              <dd>
                {words ? (
                  <span className="presence-line">
                    <span className={`dot${presence === "idle" ? " idle" : presence === "dnd" ? " dnd" : ""}`} aria-hidden />
                    {words}
                  </span>
                ) : profile?.lastSeenAt ? (
                  relative(profile.lastSeenAt)
                ) : (
                  "Not shared"
                )}
              </dd>
            </div>
          </div>
          <button className="btn btn-secondary profile-panel-full" onClick={() => openProfile(peer.id, name)}>
            View full profile
          </button>
        </div>
      </div>
    </aside>
  );
}

/** The member list for channels and groups, the profile for direct messages. */
export function PeoplePanel({ c, onClose }: { c: Conversation; onClose: () => void }) {
  return c.type === "DM" ? <ProfilePanel c={c} onClose={onClose} /> : <MemberListPanel c={c} onClose={onClose} />;
}

const prefKey = (c: Pick<Conversation, "type">): "dmProfile" | "memberList" => (c.type === "DM" ? "dmProfile" : "memberList");

/** The member list or profile kept beside the messages on wide screens, when no other side panel is open. */
export function DockedPeoplePanel({ conversationId, route }: { conversationId: string; route: Route }) {
  const c = useOrbit((s) => s.conversations[conversationId]);
  const shown = usePeopleShown(c ?? { type: "DM", voice: true }, route);
  if (!c || !shown || route.panel) return null;
  return <PeoplePanel key={c.id} c={c} onClose={() => setPrefs({ [prefKey(c)]: false })} />;
}

/**
 * The header button that shows or hides the member list (channels, groups) or the profile (DMs). On wide screens the
 * choice is remembered for every conversation of that kind; on narrower ones it opens the panel over the messages.
 */
export function PeopleToggle({ c, route }: { c: Conversation; route: Route }) {
  const wide = useWideLayout();
  const shown = usePeopleShown(c, route);
  if (!hasPeoplePanel(c)) return null;
  const dm = c.type === "DM";
  const label = `${shown ? "Hide" : "Show"} ${dm ? "the profile" : "the member list"}`;
  const toggle = () => {
    const at = { section: route.section, conversationId: c.id };
    if (wide) {
      setPrefs({ [prefKey(c)]: !shown });
      if (route.panel) navigate({ ...at, panel: null });
    } else navigate({ ...at, panel: shown ? null : "members" });
  };
  return (
    <button className="icon-btn" aria-pressed={shown} onClick={toggle} aria-label={label} title={label}>
      {dm ? <CircleUserRound size={19} /> : <UsersRound size={19} />}
    </button>
  );
}
