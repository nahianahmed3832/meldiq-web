import { Check, Flag, MessageSquare, ShieldBan, ShieldCheck, Ticket, UserCheck, UserPlus, UserX } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "../../api/client";
import { shallowEqual, useEngine, useOrbit } from "../../app/orbit";
import { navigate } from "../../app/router";
import { startDirect, userProfile } from "../../sync/account";
import { block, blockedIds, unblock } from "../../sync/profile";
import { acceptConnection, connect, connections, connectionState, invitableCommunities, inviteFromProfile, presenceWords, removeConnection } from "../../sync/social";
import { ReportDialog } from "../chat/ReportDialog";
import { UserAvatar } from "../components/OrgAvatar";
import { Dialog } from "../components/Overlay";
import { relative } from "../format";

type Profile = Awaited<ReturnType<typeof userProfile>>;

/** Opens someone's profile from anywhere (a name in a message, a member list): the shell shows the dialog. */
export const OPEN_PROFILE_EVENT = "meldiq:open-profile";
export const openProfile = (userId: string, name?: string): void => void window.dispatchEvent(new CustomEvent(OPEN_PROFILE_EVENT, { detail: { userId, name } }));

/**
 * Someone's profile as the server lets this account see it (android ProfileScreens): name, @username and pronouns, how
 * they appear (online, idle, do not disturb, last seen), their status; Message, Connect (B6), Invite to a community
 * (B4b), Report (B4) and Block.
 */
export function ProfileDialog({ userId, fallbackName, onClose }: { userId: string; fallbackName: string; onClose: () => void }) {
  const engine = useEngine();
  const me = useOrbit((s) => s.me?.userId);
  const features = useOrbit((s) => s.server?.features ?? [], shallowEqual);
  const rev = useOrbit((s) => s.connectionsRev);
  const orgs = useOrbit((s) => invitableCommunities(s.orgs), shallowEqual);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [state, setState] = useState<ReturnType<typeof connectionState> | null>(null);
  const [blocked, setBlocked] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"main" | "invite" | "report" | "confirmRemove" | "confirmBlock">("main");
  const self = userId === me;
  const hasConnections = features.includes("connections");

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
  }, [engine, userId]);
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
  const message = () =>
    void run(async () => {
      const id = await startDirect(engine, userId);
      onClose();
      navigate({ section: "dms", conversationId: id });
    });
  const name = profile?.displayName ?? fallbackName;

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
  return (
    <Dialog
      title={name}
      onClose={onClose}
      footer={
        profile && !self ? (
          <>
            {features.includes("reports") && (
              <button className="btn btn-ghost" onClick={() => setView("report")}>
                <Flag size={15} /> Report
              </button>
            )}
            {blocked !== null && (
              <button className="btn btn-ghost" disabled={busy} onClick={() => (blocked ? void run(() => unblock(engine, userId).then(() => setBlocked(false))) : setView("confirmBlock"))}>
                {blocked ? <ShieldCheck size={15} /> : <ShieldBan size={15} />} {blocked ? "Unblock" : "Block"}
              </button>
            )}
            <span className="grow" />
            {features.includes("invite-links") && orgs.length > 0 && !blocked && (
              <button className="btn btn-secondary" onClick={() => setView("invite")}>
                <Ticket size={15} /> Invite
              </button>
            )}
            {!blocked && (
              <button className="btn btn-primary" disabled={busy} onClick={message}>
                <MessageSquare size={16} /> Message
              </button>
            )}
          </>
        ) : undefined
      }
    >
      <div className="dialog-body profile-dialog">
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        {!profile ? (
          !error && <div className="skeleton" style={{ height: 64 }} aria-busy="true" />
        ) : (
          <>
            <div className="row" style={{ gap: 14 }}>
              <UserAvatar
                userId={profile.id}
                name={profile.displayName}
                colorIndex={profile.avatarColor}
                photoRev={profile.photoRev}
                size={64}
                online={profile.online}
                presence={profile.presence}
                decorative
              />
              <span className="lines">
                <strong style={{ fontSize: 17 }}>{profile.displayName}</strong>
                <small>
                  @{profile.username}
                  {profile.pronouns ? ` · ${profile.pronouns}` : ""}
                </small>
                {words ? (
                  <span className="presence-line">
                    <span className={`dot${profile.presence === "idle" ? " idle" : profile.presence === "dnd" ? " dnd" : ""}`} aria-hidden />
                    {words}
                  </span>
                ) : profile.lastSeenAt ? (
                  <small className="faint">Last seen {relative(profile.lastSeenAt)}</small>
                ) : null}
                {profile.statusText && <small className="faint">{profile.statusText}</small>}
              </span>
            </div>
            {hasConnections && !self && state && !blocked && (
              <div className="row" style={{ gap: 8 }}>
                {state === "none" && (
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={busy}
                    onClick={() => void run(async () => setState((await connect(engine, { userId })) === "accepted" ? "connected" : "sent"))}
                  >
                    <UserPlus size={14} /> Connect
                  </button>
                )}
                {state === "sent" && (
                  <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void run(() => removeConnection(engine, userId).then(() => setState("none")))} title="Cancel request">
                    <Check size={14} /> Request sent
                  </button>
                )}
                {state === "received" && (
                  <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void run(() => acceptConnection(engine, userId).then(() => setState("connected")))}>
                    <UserCheck size={14} /> Accept
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
          </>
        )}
      </div>
    </Dialog>
  );
}
