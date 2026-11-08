import { Icon } from "../icons/Icon";
import { ProfileContent } from "./ProfileContent";
import { useLocaleRender } from "../../i18n/Localized";
import { CustomEmojiImage } from "../community/CustomEmoji";
import type { CustomEmojiRef } from "../../protocol/payload";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { interfaceLocale } from "../../i18n/format";
import { useT as useLocalization } from "../../i18n";
import { CollectibleBanner, CollectibleBadge, collectibleCardVars } from "./CollectibleLayers";
import { IdentityGlyph } from "../components/IdentityGlyph";
import { BotProfileDialog } from "./BotProfileDialog";
import { Check, Copy, Flag, MoreHorizontal, SendHorizontal, ShieldBan, ShieldCheck, Ticket, UserCheck, UserPlus, UserX, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "../../api/client";
import { shallowEqual, useEngine, useOrbit } from "../../application/orbit";
import { navigate } from "../../application/router";
import { startDirect, userProfile } from "../../sync/account";
import { NO_STYLE } from "../settings/noStyle";
import { communityProfile } from "../../sync/communityProfile";
import { block, blockedIds, unblock } from "../../sync/profile";
import { acceptConnection, connect, connections, connectionState, invitableCommunities, inviteFromProfile, presenceWords, removeConnection } from "../../sync/social";
import { ReportDialog } from "../chat/ReportDialog";
import { usePhoto } from "../components/photos";
import { StyledName } from "./NameStyle";
import { ProfileEffect, StyledAvatar, useReducedMotion } from "./ProfileStyle";
import { ArtistDecorations } from "./ArtistDecorations";
import { ProfilePins } from "./ProfilePins";
import { LevelRing } from "./LevelRing";
import { themeBackground, themeColorsOf, themeVars } from "./profileTheme";
import { Dialog, Menu, type MenuEntry, useMenu } from "../components/Overlay";
import { toneOf } from "../components/Avatar";
import { OrgAvatar } from "../components/OrgAvatar";
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
  near?: {
    x: number;
    y: number;
  } | null;
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
  near?: {
    x: number;
    y: number;
  } | null;
  onClose: () => void;
}
export function ProfileDialog(props: ProfileDialogProps) {
  useLocaleRender();
  const known = useOrbit((s) => s.users[props.userId]);
  return known?.bot ? <BotProfileDialog bot={known} onClose={props.onClose} /> : <PersonProfileDialog {...props} />;
}
function PersonProfileDialog({ userId, fallbackName, orgId = null, near = null, onClose }: ProfileDialogProps) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const reducedMotion = useReducedMotion();
  const me = useOrbit((s) => s.me?.userId);
  const features = useOrbit((s) => s.server?.features ?? [], shallowEqual);
  const pinsOn = features.includes("profile-pins");
  const levelsOn = features.includes("points");
  const rev = useOrbit((s) => s.connectionsRev);
  // Their profile changed elsewhere (API 0.28 user.updated): loaded again.
  const profilesRev = useOrbit((s) => s.profilesRev);
  const orgs = useOrbit((s) => invitableCommunities(s.orgs), shallowEqual);
  const scope = `${userId}:${orgId ?? "global"}`;
  const [profileResult, setProfileResult] = useState<{
    scope: string;
    profile: Profile;
  } | null>(null);
  const profile = profileResult?.scope === scope ? profileResult.profile : null;
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
  const [roles, setRoles] = useState<
    | {
        id: string;
        name: string;
        color: string | null;
        iconExpression?: CustomEmojiRef;
      }[]
    | null
  >(null);
  const roleScope = useOrbit((s) => s.orgs.find((o) => o.id === orgId));
  useEffect(() => {
    setRoles(null);
    if (!orgId || !profile || !roleScope) return;
    let alive = true;
    directory(engine, orgId, profile.username)
      .then((people) => alive && setRoles(people.find((p) => p.id === userId)?.customRoles ?? []))
      .catch(() => alive && setRoles([]));
    return () => {
      alive = false;
    };
  }, [engine, orgId, userId, profile, roleScope]);
  useEffect(() => {
    let alive = true;
    userProfile(engine, userId)
      .then(async (p) => {
        if (orgId && features.includes("community-profiles")) {
          const local = await communityProfile(engine, orgId, userId).catch(() => null);
          if (local) {
            if (local.profile.aboutMe != null) p = { ...p, aboutMe: local.profile.aboutMe };
            if (local.profile.pronouns != null) p = { ...p, pronouns: local.profile.pronouns };
            if (local.profile.theme) p = { ...p, profileStyle: { ...(p.profileStyle ?? NO_STYLE), themeColors: local.profile.theme } };
          }
        }
        if (alive) setProfileResult({ scope, profile: p });
      })
      .catch(
        (e: unknown) =>
          alive &&
          setError(
            e instanceof ApiError && (e.status === 404 || e.status === 403)
              ? uiText("files.interface.this_profile_isn_t_available_to_you_27a8a2f")
              : e instanceof Error
                ? e.message
                : uiText("files.interface.couldn_t_load_this_profile_b598709"),
          ),
      );
    blockedIds(engine)
      .then((ids) => alive && setBlocked(ids.includes(userId)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [engine, userId, orgId, scope, features, profilesRev]);
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
      setError(e instanceof ApiError ? e.message : uiText("workspace.interface.that_didn_t_work_try_again_5da2573"));
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
      <Dialog title={uiText("files.interface.invite_value0_to_5bb3db0", { value0: name })} onClose={() => setView("main")}>
        <div className="dialog-body" style={{ gap: 2 }}>
          {error && (
            <div className="banner danger" role="alert">
              {error}
            </div>
          )}
          {orgs.length === 0 && (
            <p className="faint">
              <Localized k="files.interface.you_re_not_in_a_community_you_can_invite_people_to_7a195ea" />
            </p>
          )}
          {orgs.map((o) => (
            <button
              key={o.id}
              className="list-row"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const dm = await startDirect(engine, userId);
                  await inviteFromProfile(engine, o.id, o.name, dm);
                  engine.notice("info", uiText("files.interface.invitation_sent_to_value0_37e298f", { value0: name }));
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
            <Localized k="files.interface.the_link_works_once_for_7_days_and_goes_to_them_in_your_dm_b513130" />
          </p>
        </div>
      </Dialog>
    );
  const words = profile ? presenceWords(profile.presence, profile.online) : null;
  const more: MenuEntry[] = [
    ...(features.includes("invite-links") && orgs.length > 0 && !blocked
      ? [
          {
            get label() {
              return uiText("files.interface.invite_to_a_community_7536831");
            },
            icon: <Ticket size={16} />,
            onSelect: () => setView("invite"),
          },
        ]
      : []),
    ...(features.includes("reports") ? [{ label: l10n("messaging.msg_report"), icon: <Flag size={16} />, onSelect: () => setView("report") }] : []),
    ...(blocked !== null
      ? [
          blocked
            ? {
                get label() {
                  return uiText("messaging.interface.unblock_712da63");
                },
                icon: <ShieldCheck size={16} />,
                onSelect: () => void run(() => unblock(engine, userId).then(() => setBlocked(false))),
              }
            : {
                get label() {
                  return uiText("files.interface.block_c722535");
                },
                icon: <ShieldBan size={16} />,
                danger: true,
                onSelect: () => setView("confirmBlock"),
              },
        ]
      : []),
    ...(profile
      ? [
          {
            get label() {
              return uiText("messaging.interface.copy_username_7ba3cda");
            },
            icon: <Copy size={16} />,
            onSelect: () => void navigator.clipboard?.writeText(`@${profile.username}`).catch(() => undefined),
          },
        ]
      : []),
  ];
  const theme = themeColorsOf(profile?.profileStyle);
  return (
    <Dialog
      title={name}
      onClose={onClose}
      className={`profile-pop${theme ? " themed" : ""}`}
      vars={{ ...themeVars(theme), ...collectibleCardVars(profile?.profileStyle, !reducedMotion) }}
      near={near}
      header={
        <>
          <div className="profile-pop-banner" style={bannerUrl ? { backgroundImage: `url(${bannerUrl})` } : { background: theme ? themeBackground(theme) : toneOf(profile?.avatarColor ?? 0) }}>
            <CollectibleBanner style={profile?.profileStyle} />
            <ProfileEffect effect={profile?.profileStyle?.effect} />
            {!self && more.length > 0 && (
              <button
                className="icon-btn profile-pop-btn"
                onClick={(e) => moreMenu.open(e.currentTarget)}
                aria-label={uiText("organization.interface.more_for_value0_87b81e8", { value0: name })}
                aria-haspopup="menu"
                aria-expanded={!!moreMenu.anchor}
              >
                <MoreHorizontal size={18} />
              </button>
            )}
            <button className="icon-btn profile-pop-btn" onClick={onClose} aria-label={l10n("common.actions.close")}>
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
                collectibles={profile.profileStyle?.collectibles}
                size={92}
                online={profile.online}
                presence={profile.presence}
              />
              {hasConnections && !self && state === "none" && !blocked && (
                <button
                  className="icon-btn profile-pop-connect"
                  disabled={busy}
                  onClick={() => void run(async () => setState((await connect(engine, { userId })) === "accepted" ? "connected" : "sent"))}
                  aria-label={uiText("files.interface.connect_with_value0_ff005f7", { value0: name })}
                  title={uiText("files.interface.connect_1a2303e")}
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
              <StyledName name={profile.displayName} style={profile.profileStyle} tag={profile.tag} mojo={profile.mojo} bot={profile.bot} everyBadge className="ellipsis" />
              {levelsOn && profile.level !== null && <LevelRing level={profile.level} size={24} className="profile-level" />}
            </h2>
            <p className="profile-pop-handle">
              @{profile.username}
              {profile.pronouns && <span className="tag">{profile.pronouns}</span>}
            </p>
            {(profile.statusEmoji || profile.statusText) && <p className="profile-pop-status">{[profile.statusEmoji, profile.statusText].filter(Boolean).join(" ")}</p>}
            {/* API 0.64.0: pins replace the Bug Hunter and Artist pills (both are Meldiq pins now). */}
            <CollectibleBadge style={profile?.profileStyle} />
            {profile.badges.includes("partner") && (
              <span className="badge-pill"><Icon name="settings.membership" size={16} /> {uiText("workspace.reference.partnerBadge")}</span>
            )}
            {pinsOn ? (
              <>
                <ProfilePins pins={profile.pins} />
              </>
            ) : (
              <>
                {profile.badges.includes("bug-hunter") && (
                  <span className="badge-pill" title={uiText("files.interface.found_a_bug_meldiq_confirmed_f33009c")}>
                    <Localized k="files.interface.bug_hunter_c47a6fc" slots={[<IdentityGlyph kind="bug-hunter" size={18} />]} />
                  </span>
                )}
                {profile.decorationArtist && (
                  <span className="badge-pill" title={uiText("files.interface.made_a_profile_decoration_meldiq_approved_7fa1042")}>
                    <Localized k="files.interface.artist_d930bb8" slots={[<IdentityGlyph kind="artist" size={18} />]} />
                  </span>
                )}
              </>
            )}
            <ProfileContent profile={profile} connections={features.includes("connections-v2")} />
            {error && (
              <div className="banner danger" role="alert">
                {error}
              </div>
            )}
            <section className="profile-box" aria-label={uiText("workspace.interface.presence_d6b3e8c")}>
              <h3>{l10n("messaging.people_now")}</h3>
              {words ? (
                <span className="presence-line">
                  <span className={`dot${profile.presence === "idle" ? " idle" : profile.presence === "dnd" ? " dnd" : ""}`} aria-hidden />
                  {words}
                </span>
              ) : (
                <span className="faint">
                  {profile.lastSeenAt ? uiText("files.interface.last_seen_value0_da04867", { value0: relative(profile.lastSeenAt) }) : uiText("files.interface.not_shown_a08f0f9")}
                </span>
              )}
            </section>
            <MemberSince profile={profile} orgId={orgId} />
            {profile.decorationArtist && <ArtistDecorations userId={profile.id} name={profile.displayName} />}
            {roles && roles.length > 0 && (
              <section className="profile-box" aria-label={l10n("organization.roles")}>
                <h3>{l10n("organization.roles")}</h3>
                <div className="profile-roles">
                  {roles.map((r) => (
                    <span key={r.id} className="profile-role">
                      {r.iconExpression ? (
                        <CustomEmojiImage id={r.iconExpression.id} name={r.iconExpression.name} sha256={r.iconExpression.sha256} size={16} />
                      ) : (
                        <i style={{ background: r.color ?? "var(--text-3)" }} aria-hidden="true" />
                      )}
                      {r.name}
                    </span>
                  ))}
                </div>
              </section>
            )}
            {profile.mutualCommunities.length > 0 && (
              <section className="profile-box profile-mutuals" aria-label={uiText("files.interface.mutual_communities_ed63dbb")}>
                <span className="profile-mutual-icons" aria-hidden="true">
                  {profile.mutualCommunities.slice(0, 3).map((o) => (
                    <OrgAvatar key={o.id} orgId={o.id} name={o.name} photoRev={o.photoRev} size={26} />
                  ))}
                </span>
                <span className="grow" title={profile.mutualCommunities.map((o) => o.name).join(", ")}>
                  <Localized
                    k="files.interface.mutual_fc10b9b"
                    slots={[
                      profile.mutualCommunities.length,
                      profile.mutualCommunities.length === 1 ? uiText("workspace.interface.community_f354ee9") : uiText("workspace.interface.communities_6f2e8a1"),
                    ]}
                  />
                </span>
              </section>
            )}
            {hasConnections && !self && state && state !== "none" && !blocked && (
              <div className="row" style={{ gap: 8 }}>
                {state === "sent" && (
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={busy}
                    onClick={() => void run(() => removeConnection(engine, userId).then(() => setState("none")))}
                    title={uiText("files.interface.cancel_request_5619668")}
                  >
                    <Localized k="files.interface.request_sent_bd829ba" slots={[<Check size={14} />]} />
                  </button>
                )}
                {state === "received" && (
                  <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void run(() => acceptConnection(engine, userId).then(() => setState("connected")))}>
                    <Localized k="files.interface.accept_connection_4d1e03c" slots={[<UserCheck size={14} />]} />
                  </button>
                )}
                {state === "connected" && (
                  <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => setView("confirmRemove")}>
                    <UserCheck size={14} /> {l10n("calls.connected")}
                  </button>
                )}
              </div>
            )}
            {view === "confirmRemove" && (
              <div className="banner info" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className="grow">
                  <Localized k="files.interface.from_your_connections_they_aren_t_told_24325a0" slots={[l10n("common.actions.remove"), name]} />
                </span>
                <button className="btn btn-secondary btn-sm" onClick={() => setView("main")}>
                  <Localized k="files.interface.keep_183f00f" />
                </button>
                <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => void run(() => removeConnection(engine, userId).then(() => (setState("none"), setView("main"))))}>
                  <UserX size={14} /> {l10n("common.actions.remove")}
                </button>
              </div>
            )}
            {view === "confirmBlock" && (
              <div className="banner info" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className="grow">
                  <Localized k="files.interface.block_their_messages_are_dropped_before_they_reach_you_and_they_a_a926544" slots={[name]} />
                </span>
                <button className="btn btn-secondary btn-sm" onClick={() => setView("main")}>
                  {l10n("common.actions.cancel")}
                </button>
                <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => void run(() => block(engine, userId).then(() => (setBlocked(true), setView("main"))))}>
                  <Localized k="messaging.interface.block_211d0bb" />
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
                <input
                  className="input"
                  value={draft}
                  maxLength={4000}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={uiText("files.interface.message_value0_6a54b68", { value0: profile.username })}
                  aria-label={uiText("messaging.interface.message_value0_ddd26fd", { value0: name })}
                />
                <button
                  className="btn btn-primary"
                  disabled={busy}
                  aria-label={draft.trim() ? uiText("files.interface.send_to_value0_66c54f8", { value0: name }) : uiText("files.interface.open_a_conversation_with_value0_d07e31b", { value0: name })}
                >
                  <SendHorizontal size={16} />
                </button>
              </form>
            )}
          </>
        )}
      </div>
      {moreMenu.anchor && <Menu anchor={moreMenu.anchor} label={uiText("organization.interface.more_for_value0_87b81e8", { value0: name })} onClose={moreMenu.close} entries={more} align="end" />}
    </Dialog>
  );
}
/**
 * Member since (the owner's reference, 2026-10-28): when they joined Meldiq, and, opened from a community you share,
 * when they joined it. Absent on servers before API 0.57.0.
 */
function MemberSince({ profile, orgId }: { profile: Profile; orgId: string | null }) {
  useLocaleRender();
  const here = orgId ? profile.mutualCommunities.find((o) => o.id === orgId) : undefined;
  if (!profile.memberSince && !here) return null;
  const day = (t: number) => new Date(t).toLocaleDateString(interfaceLocale(), { day: "numeric", month: "short", year: "numeric" });
  return (
    <section className="profile-box" aria-label={uiText("files.interface.member_since_9321bcc")}>
      <h3>
        <Localized k="files.interface.member_since_9321bcc" />
      </h3>
      <div className="profile-since">
        {profile.memberSince && (
          <span title={uiText("files.interface.joined_meldiq_f83a548")}>
            <img src="/meldling-96.webp" width={20} height={20} alt="Meldiq" draggable={false} />
            {day(profile.memberSince)}
          </span>
        )}
        {here && (
          <span title={uiText("files.interface.joined_value0_1caa71b", { value0: here.name })}>
            <OrgAvatar orgId={here.id} name={here.name} photoRev={here.photoRev} size={20} />
            {day(here.joinedAt)}
          </span>
        )}
      </div>
    </section>
  );
}
