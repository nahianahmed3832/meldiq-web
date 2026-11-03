import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { OrgAvatar } from "../components/OrgAvatar";
import { usePhoto } from "../components/photos";
import { ACCENT_CLASS, accentBand, accentStyle } from "../community/accent";
import { Building2, Ticket, Users } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../../api/client";
import type { InvitePreview } from "../../api/workspaceSchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import type { OrgKind } from "../../api/schemas";
import { setPrefs } from "../../application/prefs";
import { navigate } from "../../application/router";
import { acceptInvite, createWorkspace, previewInvite, requestId } from "../../sync/workspaces";
import { cleanInviteCode, roleName } from "../../sync/workspaceRules";
import { Dialog } from "../components/Overlay";
import { checkInvite, extractInvite } from "../../sync/inviteCodes";
const errorText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);
/** A new organisation workspace, owned by this account. One request id per form, so a retry never makes two. */
export function CreateWorkspaceDialog({ onClose }: { onClose: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const reqId = useMemo(requestId, []);
  // Meldiq 2.0: a team or a community, offered only where the server has communities.
  const communities = useOrbit((s) => s.server?.features.includes("communities") ?? false);
  const [kind, setKind] = useState<OrgKind>("team");
  const community = communities && kind === "community";
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError(community ? uiText("organization.interface.give_the_community_a_name_789d631") : uiText("organization.interface.give_the_community_a_name_789d631"));
    setBusy(true);
    setError(null);
    try {
      const org = await createWorkspace(engine, name, description || null, reqId, community ? "community" : "team");
      setPrefs({ orgId: org.id });
      onClose();
      navigate({ section: "workspace", workspacePage: "invitations" });
    } catch (err) {
      setError(errorText(err, community ? uiText("organization.interface.couldn_t_create_the_community_1d96bd2") : uiText("organization.interface.couldn_t_create_the_community_1d96bd2")));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title={community ? l10n("workspace.home_start_community") : l10n("workspace.rail_create")} onClose={onClose}>
      <form className="dialog-body" onSubmit={(e) => void submit(e)} noValidate>
        {communities && (
          <div className="kind-choice" role="radiogroup" aria-label={uiText("workspace.interface.what_is_it_for_b585811")}>
            <button type="button" role="radio" aria-checked={!community} className="kind-option" onClick={() => setKind("team")}>
              <Building2 size={18} aria-hidden />
              <span>
                <strong>
                  <Localized k="workspace.interface.team_5985039" />
                </strong>
                <small>
                  <Localized k="workspace.interface.colleagues_working_together_branches_teams_and_admin_tools_34d8021" />
                </small>
              </span>
            </button>
            <button type="button" role="radio" aria-checked={community} className="kind-option" onClick={() => setKind("community")}>
              <Users size={18} aria-hidden />
              <span>
                <strong>{l10n("organization.community")}</strong>
                <small>
                  <Localized k="workspace.interface.people_with_a_shared_interest_channels_voice_rooms_and_open_invit_7b60311" />
                </small>
              </span>
            </button>
          </div>
        )}
        <p className="muted" style={{ margin: 0 }}>
          {community
            ? uiText("workspace.interface.it_starts_with_welcome_announcements_general_introductions_and_a_a1cf61e")
            : uiText("workspace.interface.a_community_holds_your_organisation_s_channels_branches_and_teams_29839eb")}
        </p>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <div className="field">
          <label htmlFor="cw-name">
            <Localized k="messaging.interface.name_dcd1d52" />
          </label>
          <input
            id="cw-name"
            className="input"
            data-autofocus
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder={community ? uiText("organization.interface.dhaka_makers_8027676") : uiText("workspace.interface.acme_inc_ee60673")}
          />
        </div>
        <div className="field">
          <label htmlFor="cw-desc">
            <Localized k="organization.interface.description_optional_f6cbe2f" />
          </label>
          <input id="cw-desc" className="input" value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {l10n("common.actions.cancel")}
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {community ? <Users size={16} /> : <Building2 size={16} />}{" "}
            {busy ? l10n("auth.signup_busy") : community ? uiText("organization.interface.create_community_5d6da55") : uiText("organization.interface.create_community_5d6da55")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
/** Joins a workspace with an invitation code: shows what it is first (preview), then accepts. */
export function JoinWorkspaceDialog({ onClose, initialCode }: { onClose: () => void; initialCode?: string }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const [code, setCode] = useState(initialCode ?? "");
  const community = useOrbit((s) => s.server?.features.includes("community-channels") ?? false);
  const noun = community ? uiText("workspace.interface.community_f354ee9") : uiText("workspace.interface.workspace_a279fe9");
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const check = async (e?: FormEvent, raw = code) => {
    e?.preventDefault();
    // A pasted invite link or invite message works as well as the code itself (android InviteCodes).
    const typed = checkInvite(raw);
    const c = extractInvite(raw) ?? (typed.kind === "ok" ? typed.code : null);
    if (!c) return setError(typed.kind === "invalid" ? typed.reason : uiText("workspace.interface.enter_the_invitation_code_you_were_given_533eff5"));
    setCode(c);
    setBusy(true);
    setError(null);
    try {
      setPreview(await previewInvite(engine, c));
    } catch (err) {
      setError(errorText(err, uiText("workspace.interface.couldn_t_check_that_code_da1e29f")));
    } finally {
      setBusy(false);
    }
  };
  // Opened from an invitation link (application/pendingInvite.ts): straight to the community's preview.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || !initialCode) return;
    opened.current = true;
    void check(undefined, initialCode);
    // Once, for the code it opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);
  const join = async () => {
    if (preview?.alreadyMember) {
      setPrefs({ orgId: preview.org.id });
      onClose();
      navigate({ section: "home" });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const org = await acceptInvite(engine, extractInvite(code) ?? cleanInviteCode(code));
      setPrefs({ orgId: org.id });
      onClose();
      navigate({ section: "home" });
    } catch (err) {
      setError(errorText(err, uiText("workspace.interface.couldn_t_join_the_value0_5d4dd0c", { value0: noun })));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      title={preview ? uiText("workspace.interface.join_value0_81fbd12", { value0: preview.org.name }) : uiText("workspace.interface.join_a_value0_4d1e364", { value0: noun })}
      onClose={onClose}
      className={preview ? "invite-landing-dialog" : undefined}
    >
      <div className="dialog-body">
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        {!preview ? (
          <form onSubmit={(e) => void check(e)} style={{ display: "grid", gap: 14 }} noValidate>
            <div className="field">
              <label htmlFor="jw-code">{l10n("auth.signin_invite_label")}</label>
              <input id="jw-code" className="input mono" data-autofocus value={code} onChange={(e) => setCode(e.target.value)} placeholder={"ABCD-EFGH-JKLM"} autoComplete="off" spellCheck={false} />
              <span className="hint">
                <Localized k="workspace.interface.ask_a_member_for_one_you_can_paste_the_whole_invite_message_or_li_a43dda7" />
              </span>
            </div>
            <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                {l10n("common.actions.cancel")}
              </button>
              <button className="btn btn-primary" disabled={busy}>
                <Ticket size={16} /> {busy ? l10n("common.common_checking") : l10n("common.actions.continue")}
              </button>
            </div>
          </form>
        ) : (
          <div className={`invite-landing${preview.org.accent ? ` ${ACCENT_CLASS}` : ""}`} style={accentStyle(preview.org.accent)}>
            <InviteBanner code={extractInvite(code) ?? cleanInviteCode(code)} rev={preview.org.bannerRev} accent={preview.org.accent} />
            <span className="invite-landing-icon">
              <OrgAvatar orgId={preview.org.id} name={preview.org.name} photoRev={null} size={88} />
            </span>
            <p className="invite-landing-lead">
              <Localized k="workspace.interface.you_ve_been_invited_to_join_1c4ddf0" />
            </p>
            <h3 className="invite-landing-name">{preview.org.name}</h3>
            {preview.org.memberCount !== undefined && (
              <p className="invite-landing-members">
                <i aria-hidden="true" />
                {preview.org.memberCount === 1 ? uiText("common.counts.members", { count: 1 }) : uiText("common.counts.members", { count: preview.org.memberCount })}
              </p>
            )}
            {preview.org.description && <p className="muted invite-landing-about">{preview.org.description}</p>}
            {!preview.alreadyMember && (
              <p className="faint invite-landing-role">
                <Localized
                  k="workspace.interface.you_ll_join_as_8a47da0"
                  slots={[
                    roleName(preview.role).toLowerCase(),
                    preview.branch ? uiText("workspace.interface.in_value0_e1b84d9", { value0: preview.branch.name }) : "",
                    preview.team ? uiText("workspace.interface.team_value0_57ff5e2", { value0: preview.team.name }) : "",
                  ]}
                />
              </p>
            )}
            {!preview.alreadyMember && preview.banned && (
              <div className="banner danger">
                <Localized k="workspace.interface.you_ve_been_banned_from_this_so_you_can_t_join_it_61b1842" slots={[noun]} />
              </div>
            )}
            {!preview.alreadyMember && !preview.banned && preview.invitesPaused && (
              <div className="banner warn">
                <Localized k="workspace.interface.this_has_paused_new_members_for_now_try_again_later_7e08ba6" slots={[noun]} />
              </div>
            )}
            <button className="btn btn-primary btn-lg invite-landing-go" disabled={busy || (!preview.alreadyMember && (preview.banned || preview.invitesPaused))} onClick={() => void join()}>
              {busy
                ? l10n("workspace.discover_joining")
                : preview.alreadyMember
                  ? uiText("workspace.interface.you_re_already_in_open_it_7745f9f")
                  : uiText("workspace.interface.join_value0_81fbd12", { value0: preview.org.name })}
            </button>
            <button type="button" className="link-btn" onClick={() => setPreview(null)}>
              <Localized k="workspace.interface.use_a_different_code_4114800" />
            </button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
/** The invited community's banner (API 0.44.0), or a band in its accent; nothing for a community without either. */
function InviteBanner({ code, rev, accent }: { code: string; rev: number | null; accent: string | null }) {
  useLocaleRender();
  const url = usePhoto("inviteBanner", code, rev);
  if (!url && !accent) return null;
  return <div className="invite-landing-banner" style={url ? { backgroundImage: `url(${url})` } : { background: accentBand(accent ?? "") }} aria-hidden="true" />;
}
