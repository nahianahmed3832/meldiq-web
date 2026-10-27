import { Check, Copy, Flag, MoreHorizontal, SendHorizontal, ShieldBan, ShieldCheck, Ticket, UserCheck, UserPlus, UserX, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "../../api/client";
import { shallowEqual, useEngine, useOrbit } from "../../application/orbit";
import { navigate } from "../../application/router";
import { startDirect, userProfile } from "../../sync/account";
import { block, blockedIds, unblock } from "../../sync/profile";
import { acceptConnection, connect, connections, connectionState, invitableCommunities, inviteFromProfile, presenceWords, removeConnection } from "../../sync/social";
import { ReportDialog } from "../chat/ReportDialog";
import { usePhoto } from "../components/photos";
import { StyledName } from "./NameStyle";
import { ProfileEffect, StyledAvatar } from "./ProfileStyle";
import { Dialog, Menu, type MenuEntry, useMenu } from "../components/Overlay";
import { toneOf } from "../components/Avatar";
import { directory } from "../../sync/workspaces";
import { relative } from "../format";

type Profile = Awaited<ReturnType<typeof userProfile>>;

/** Opens someone's profile from anywhere (a name in a message, a member list): the shell shows the dialog. */
export const OPEN_PROFILE_EVENT = "meldiq:open-profile";
/** Where a profile was opened: the community it was opened in (for their roles) and what was clicked (to sit beside it). */
export interface ProfileContext {
  orgId?: string | null;
  anchor?: Element | null;
}
export interface ProfileRequest {
  userId: string;
  name?: string;
  orgId?: string | null;
  near?: { x: number; y: number } | null;
}
export const openProfile = (userId: string, name?: string, ctx: ProfileContext = {}): void => {
  const r = ctx.anchor?.getBoundingClientRect();
  const detail: ProfileRequest = { userId, name, orgId: ctx.orgId ?? null, near: r ? { x: r.left, y: r.top } : null };
  window.dispatchEvent(new CustomEvent(OPEN_PROFILE_EVENT, { detail }));
};

/**
 * Someone's profile as the server lets this account see it (android ProfileScreens): name, @username and pronouns, how
 * they appear (online, idle, do not disturb, last seen), their status; Message, Connect (B6), Invite to a community
 * (B4b), Report (B4) and Block.
 */
interface ProfileDialogProps {
  userId: string;
  fallbackName: string;
  /** The community it was opened in: their roles there are shown. */
  orgId?: string | null;
  /** Wide screens: beside this point (the member list), as the reference's profile card. */
  near?: { x: number; y: number } | null;
  onClose: () => void;
}

export function ProfileDialog({ userId, fallbackName, orgId = null, near = null, onClose }: ProfileDialogProps) {
  const engine = useEngine();
  const me = useOrbit((s) => s.me?.userId);
  const features = useOrbit((s) => s.server?.features ?? [], shallowEqual);
  const rev = useOrbit((s) => s.connectionsRev);
  // Their profile changed elsewhere (API 0.28 user.updated): loaded again.
  const profilesRev = useOrbit((s) => s.profilesRev);
  const orgs = useOrbit((s) => invitableCommunities(s.orgs), shallowEqual);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [state, setState] = useState<ReturnType<typeof connectionState> | null>(null);
  const [blocked, setBlocked] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"main" | "invite" | "report" | "confirmRemove" | "confirmBlock">("main");
  const self = userId === me;
  const hasConnections = features.includes("connections");
  const moreMenu = useMenu();
  const [draft, setDraft] = useState("");
  // Their roles in the community it was opened from (the member directory; empty where this account can't see it).
  const [roles, setRoles] = useState<{ id: string; name: string; color: string | null }[] | null>(null);
  useEffect(() => {
    if (!orgId || !profile) return;
    let alive = true;
    directory(engine, orgId, profile.username)
      .then((people) => alive && setRoles(people.find((p) => p.id === userId)?.customRoles ?? []))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [engine, orgId, userId, profile]);

  useEffect(() => {
    let alive = true;
    userProfile(engine, userId)
      .then((p) => alive && setProfile(p))
      .catch(
        (e: unknown) =>
          alive && setError(e instanceof ApiError && (e.status === 404 || e.status === 403) ? "This profile isn't available to you." : e instanceof Error ? e.message : "Couldn't load this profile."),
      );
    blockedIds(engine)
      .then((ids) => alive && setBlocked(ids.includes(userId)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [engine, userId, profilesRev]);
  useEffect(() => {
    if (!hasConnections || self) return;
    let alive = true;
    connections(engine)
      .then((l) => alive && setState(connectionState(l, userId)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [engine, userId, hasConnections, self, rev]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const name = profile?.displayName ?? fallbackName;
  // API 0.45.0: their banner (a still or animated image), else their accent or avatar colour.
  const bannerKind = profile?.profileBanner?.kind;
  const bannerUrl = usePhoto("profileBanner", userId, profile?.profileBanner?.rev, bannerKind === "gif" ? "image/gif" : bannerKind === "webp" ? "image/webp" : "image/jpeg");

  if (view === "report") {
    const communities = orgs.map((o) => ({ id: o.id, name: o.name }));
    return <ReportDialog target={{ kind: "person", userId, name, communities }} onBlock={() => void run(() => block(engine, userId).then(() => setBlocked(true)))} onClose={onClose} />;
  }
  if (view === "invite")
    return (
      <Dialog title={`Invite ${name} to`} onClose={() => setView("main")}>
        <div className="dialog-body" style={{ gap: 2 }}>
          {error && (
            <div className="banner danger" role="alert">
              {error}
            </div>
          )}
          {orgs.length === 0 && <p className="faint">You're not in a community you can invite people to.</p>}
          {orgs.map((o) => (
            <button
              key={o.id}
              className="list-row"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const dm = await startDirect(engine, userId);
                  await inviteFromProfile(engine, o.id, o.name, dm);
                  engine.notice("info", `Invitation sent to ${name}`);
                  onClose();
                  navigate({ section: "dms", conversationId: dm });
                })
              }
            >
              <span className="lines">
                <span style={{ fontWeight: 600 }}>{o.name}</span>
              </span>
            </button>
          ))}
          <p className="faint" style={{ margin: "6px 0 0", fontSize: 12.5 }}>
            The link works once, for 7 days, and goes to them in your DM.
          </p>
        </div>
      </Dialog>
    );

  const words = profile ? presenceWords(profile.presence, profile.online) : null;
  const more: MenuEntry[] = [
    ...(features.includes("invite-links") && orgs.length > 0 && !blocked ? [{ label: "Invite to a community…", icon: <Ticket size={16} />, onSelect: () => setView("invite") }] : []),
    ...(features.includes("reports") ? [{ label: "Report…", icon: <Flag size={16} />, onSelect: () => setView("report") }] : []),
    ...(blocked !== null
      ? [
          blocked
            ? { label: "Unblock", icon: <ShieldCheck size={16} />, onSelect: () => void run(() => unblock(engine, userId).then(() => setBlocked(false))) }
            : { label: "Block…", icon: <ShieldBan size={16} />, danger: true, onSelect: () => setView("confirmBlock") },
        ]
      : []),
    ...(profile ? [{ label: "Copy username", icon: <Copy size={16} />, onSelect: () => void navigator.clipboard?.writeText(`@${profile.username}`).catch(() => undefined) }] : []),
  ];
  return (
    <Dialog
      title={name}
      onClose={onClose}
      className="profile-pop"
      near={near}
      header={
        <>
          <div className="profile-pop-banner" style={bannerUrl ? { backgroundImage: `url(${bannerUrl})` } : { background: profile?.profileStyle?.accent ?? toneOf(profile?.avatarColor ?? 0) }}>
            <ProfileEffect effect={profile?.profileStyle?.effect} />
            {!self && more.length > 0 && (
              <button className="icon-btn profile-pop-btn" onClick={(e) => moreMenu.open(e.currentTarget)} aria-label={`More for ${name}`} aria-haspopup="menu" aria-expanded={!!moreMenu.anchor}>
                <MoreHorizontal size={18} />
              </button>
            )}
            <button className="icon-btn profile-pop-btn" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
          {profile && (
            <div className="profile-pop-avatar">
              <StyledAvatar
                userId={profile.id}
                name={profile.displayName}
                colorIndex={profile.avatarColor}
                photoRev={profile.photoRev}
                media={profile.avatarMedia}
                decoration={profile.profileStyle?.decoration ?? null}
                size={92}
                online={profile.online}
                presence={profile.presence}
              />
              {hasConnections && !self && state === "none" && !blocked && (
                <button
                  className="icon-btn profile-pop-connect"
                  disabled={busy}
                  onClick={() => void run(async () => setState((await connect(engine, { userId })) === "accepted" ? "connected" : "sent"))}
                  aria-label={`Connect with ${name}`}
                  title="Connect"
                >
                  <UserPlus size={19} />
                </button>
              )}
            </div>
          )}
        </>
      }
    >
      <div className="profile-pop-body">
        {!profile ? (
          error ? (
            <div className="banner danger" role="alert">
              {error}
            </div>
          ) : (
            <div className="skeleton" style={{ height: 120 }} aria-busy="true" />
          )
        ) : (
          <>
            <h2 className="profile-pop-name">
              <StyledName name={profile.displayName} style={profile.profileStyle} tag={profile.tag} className="ellipsis" />
            </h2>
            <p className="profile-pop-handle">
              @{profile.username}
              {profile.pronouns && <span className="tag">{profile.pronouns}</span>}
            </p>
            {(profile.statusEmoji || profile.statusText) && <p className="profile-pop-status">{[profile.statusEmoji, profile.statusText].filter(Boolean).join(" ")}</p>}
            {error && (
              <div className="banner danger" role="alert">
                {error}
              </div>
            )}
            <section className="profile-box" aria-label="Presence">
              <h3>Now</h3>
              {words ? (
                <span className="presence-line">
                  <span className={`dot${profile.presence === "idle" ? " idle" : profile.presence === "dnd" ? " dnd" : ""}`} aria-hidden />
                  {words}
                </span>
              ) : (
                <span className="faint">{profile.lastSeenAt ? `Last seen ${relative(profile.lastSeenAt)}` : "Not shown"}</span>
              )}
            </section>
            {roles && roles.length > 0 && (
              <section className="profile-box" aria-label="Roles">
                <h3>Roles</h3>
                <div className="profile-roles">
                  {roles.map((r) => (
                    <span key={r.id} className="profile-role">
                      <i style={{ background: r.color ?? "var(--text-3)" }} aria-hidden="true" />
                      {r.name}
                    </span>
                  ))}
                </div>
              </section>
            )}
            {hasConnections && !self && state && state !== "none" && !blocked && (
              <div className="row" style={{ gap: 8 }}>
                {state === "sent" && (
                  <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void run(() => removeConnection(engine, userId).then(() => setState("none")))} title="Cancel request">
                    <Check size={14} /> Request sent
                  </button>
                )}
                {state === "received" && (
                  <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void run(() => acceptConnection(engine, userId).then(() => setState("connected")))}>
                    <UserCheck size={14} /> Accept connection
                  </button>
                )}
                {state === "connected" && (
                  <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => setView("confirmRemove")}>
                    <UserCheck size={14} /> Connected
                  </button>
                )}
              </div>
            )}
            {view === "confirmRemove" && (
              <div className="banner info" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className="grow">Remove {name} from your connections? They aren't told.</span>
                <button className="btn btn-secondary btn-sm" onClick={() => setView("main")}>
                  Keep
                </button>
                <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => void run(() => removeConnection(engine, userId).then(() => (setState("none"), setView("main"))))}>
                  <UserX size={14} /> Remove
                </button>
              </div>
            )}
            {view === "confirmBlock" && (
              <div className="banner info" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className="grow">Block {name}? Their messages are dropped before they reach you, and they aren't told.</span>
                <button className="btn btn-secondary btn-sm" onClick={() => setView("main")}>
                  Cancel
                </button>
                <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => void run(() => block(engine, userId).then(() => (setBlocked(true), setView("main"))))}>
                  Block
                </button>
              </div>
            )}
            {!self && !blocked && (
              <form
                className="profile-pop-message"
                onSubmit={(e) => {
                  e.preventDefault();
                  const text = draft.trim();
                  void run(async () => {
                    const id = await startDirect(engine, userId);
                    if (text) await engine.sendText(id, text);
                    onClose();
                    navigate({ section: "dms", conversationId: id });
                  });
                }}
              >
                <input className="input" value={draft} maxLength={4000} onChange={(e) => setDraft(e.target.value)} placeholder={`Message @${profile.username}`} aria-label={`Message ${name}`} />
                <button className="btn btn-primary" disabled={busy} aria-label={draft.trim() ? `Send to ${name}` : `Open a conversation with ${name}`}>
                  <SendHorizontal size={16} />
                </button>
              </form>
            )}
          </>
        )}
      </div>
      {moreMenu.anchor && <Menu anchor={moreMenu.anchor} label={`More for ${name}`} onClose={moreMenu.close} entries={more} align="end" />}
    </Dialog>
  );
}
