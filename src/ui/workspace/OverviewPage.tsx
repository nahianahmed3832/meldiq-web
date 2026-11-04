import { countLabel } from "../../i18n/counts";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { TagCard } from "./TagCard";
import { TransferOwnership } from "./TransferOwnership";
import { AppearanceCard } from "./AppearanceCard";
import { Camera, LogOut, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useCommunityServer, useEngine, useOrbit } from "../../application/orbit";
import { setPrefs } from "../../application/prefs";
import { navigate } from "../../application/router";
import { leaveWorkspace, removeWorkspacePhoto, setWorkspaceKind, setWorkspacePhoto, updateWorkspace } from "../../sync/workspaces";
import type { OrgKind } from "../../api/schemas";
import { roleName } from "../../sync/workspaceRules";
import { OrgAvatar } from "../components/OrgAvatar";
import { Dialog } from "../components/Overlay";
import { animatedUpload, squareJpeg } from "./photo";
import { useAction } from "./useLoad";
import { useUnsavedChanges } from "../components/UnsavedChanges";
import { Card, ErrorLine } from "../components/SettingsCard";
import { GuestPolicyCard } from "./WorkspaceSetupCards";
import { ProfileExtrasCards } from "./ProfileExtrasCards";
import { PARITY_FEATURES } from "../../sync/communityParity";
import { SETTINGS_LIMITS } from "../../sync/communitySettings";
import { DeleteCommunityDialog } from "../community/DeleteCommunityDialog";
interface OverviewPageProps {
  detail: OrgAdminDetail;
  onChanged: () => void;
}
/**
 * Community settings › Profile (the reference's server profile): details, tag, who can find and join, safety, then
 * ownership and membership. A community's accent and banner live on Theme; older team servers keep them here.
 */
export function OverviewPage({ detail, onChanged }: OverviewPageProps) {
  useLocaleRender();
  const { org, permissions: can, stats } = detail;
  const features = useOrbit((s) => s.server?.features ?? []);
  const community = features.includes("community-channels");
  return (
    <div className="ws-page">
      <header className="ws-hero">
        <OrgAvatar orgId={org.id} name={org.name} photoRev={org.photoRev} size={64} />
        <div className="grow">
          <h2>{org.name}</h2>
          <p className="muted">
            {org.kind === "community"
              ? uiText("workspace.interface.native_count_43804b0a2", {
                  value0: roleName(org.myRole),
                  value1: countLabel(stats.members, "members"),
                  value2: "",
                  value3: stats.channels,
                })
              : uiText("workspace.interface.native_count_ad19e3d4a", {
                  value0: roleName(org.myRole),
                  value1: countLabel(stats.members, "members"),
                  value2: "",
                  value3: stats.channels,
                  value4: stats.branches,
                  value5: stats.teams,
                })}
          </p>
        </div>
      </header>
      {can.canManageOrg ? <Identity detail={detail} onChanged={onChanged} /> : <ReadOnlyAbout description={org.description} />}
      {!community && features.includes("community-branding") && <AppearanceCard detail={detail} onChanged={onChanged} />}
      {features.includes("community-tags") && <TagCard detail={detail} onChanged={onChanged} />}
      {community && can.canManageOrg && features.includes(PARITY_FEATURES.settings) && <ProfileExtrasCards detail={detail} onChanged={onChanged} />}
      {can.canManageOrg && features.includes("guest-expiry") && <GuestPolicyCard detail={detail} onChanged={onChanged} />}
      {/* Every workspace is a community since API 0.12: the team/community switch is only for older servers. */}
      {features.includes("communities") && !features.includes("community-channels") && <KindCard detail={detail} onChanged={onChanged} />}
      <TransferOwnership detail={detail} onChanged={onChanged} />
      <Membership detail={detail} />
    </div>
  );
}
/** Team or community (Meldiq 2.0). Owners switch it; only what the apps show first changes, never members or data. */
function KindCard({ detail, onChanged }: { detail: OrgAdminDetail; onChanged: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const { org } = detail;
  const owner = org.myRole === "OWNER";
  const save = useAction();
  const choose = (kind: OrgKind) => {
    if (!owner || kind === org.kind) return;
    void save.act(() => setWorkspaceKind(engine, org.id, kind).then(onChanged));
  };
  return (
    <Card
      title={uiText("workspace.interface.kind_of_community_eabe13d")}
      sub={owner ? uiText("workspace.interface.changes_what_meldiq_shows_first_nothing_is_added_or_removed_2797a2b") : uiText("workspace.interface.only_owners_can_change_this_5aa1dc2")}
    >
      <ErrorLine text={save.error} />
      <div className="kind-choice" role="radiogroup" aria-label={uiText("workspace.interface.kind_of_community_eabe13d")}>
        {(["team", "community"] as const).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={org.kind === k} className="kind-option" disabled={!owner || save.busy} onClick={() => choose(k)}>
            <span>
              <strong>{k === "team" ? uiText("workspace.interface.team_5985039") : l10n("organization.community")}</strong>
              <small>
                {k === "team"
                  ? uiText("workspace.interface.colleagues_working_together_branches_teams_and_admin_tools_34d8021")
                  : uiText("workspace.interface.people_with_a_shared_interest_channels_voice_rooms_and_open_invit_7b60311")}
              </small>
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}
function ReadOnlyAbout({ description }: { description: string | null }) {
  useLocaleRender();
  const l10n = useLocalization();
  return (
    <Card title={l10n("settings.settings_about")} sub={uiText("workspace.interface.only_owners_and_admins_can_change_the_community_s_name_descriptio_c73c588")}>
      <p style={{ margin: 0 }}>
        {description || (
          <span className="faint">
            <Localized k="workspace.interface.no_description_06a6948" />
          </span>
        )}
      </p>
    </Card>
  );
}
function Identity({ detail, onChanged }: { detail: OrgAdminDetail; onChanged: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const { org } = detail;
  const community = useCommunityServer();
  const [name, setName] = useState(org.name);
  const [description, setDescription] = useState(org.description ?? "");
  const save = useAction();
  const photo = useAction();
  const file = useRef<HTMLInputElement>(null);
  const animatedImages = useOrbit((s) => s.server?.features.includes("animated-community-images") ?? false);
  // Community parity A3: names up to 100 characters (80 before).
  const nameMax = useOrbit((s) => (s.server?.features.includes(PARITY_FEATURES.settings) ? SETTINGS_LIMITS.name : 80));
  useEffect(() => {
    setName(org.name);
    setDescription(org.description ?? "");
  }, [org.name, org.description]);
  const dirty = name.trim() !== org.name || (description.trim() || null) !== (org.description ?? null);
  useUnsavedChanges(dirty);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    void save.act(() => updateWorkspace(engine, org.id, { name: name.trim(), description: description.trim() || null }));
  };
  const pick = (f: File | undefined) => {
    if (!f) return;
    void photo.act(async () => {
      // API 0.64.0: an animated GIF or WebP goes up as it is; anything else is cropped to a 512 px JPEG.
      await setWorkspacePhoto(engine, org.id, (await animatedUpload(f, "icon", animatedImages)) ?? (await squareJpeg(f)));
      onChanged();
    });
  };
  return (
    <Card
      title={community ? uiText("workspace.interface.community_details_680a98c") : uiText("workspace.interface.community_details_680a98c")}
      sub={uiText("workspace.interface.members_see_the_name_description_and_photo_they_aren_t_end_to_end_575bbdf")}
    >
      <div className="row" style={{ gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <OrgAvatar orgId={org.id} name={org.name} photoRev={org.photoRev} size={56} />
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
        <button className="btn btn-secondary btn-sm" disabled={photo.busy} onClick={() => file.current?.click()}>
          <Camera size={14} /> {org.photoRev ? uiText("settings.interface.change_photo_c5fbcb8") : uiText("settings.interface.add_photo_c0660be")}
        </button>
        {animatedImages && (
          <small className="faint">
            <Localized k="workspace.interface.a_gif_or_webp_stays_animated_up_to_4_mb_484d73f" />
          </small>
        )}
        {org.photoRev && (
          <button className="btn btn-ghost btn-sm" disabled={photo.busy} onClick={() => void photo.act(() => removeWorkspacePhoto(engine, org.id).then(onChanged))}>
            {l10n("common.actions.remove")}
          </button>
        )}
      </div>
      <ErrorLine text={photo.error} />
      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <div className="field">
          <label htmlFor="ws-name">
            <Localized k="messaging.interface.name_dcd1d52" />
          </label>
          <input id="ws-name" className="input" value={name} maxLength={nameMax} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ws-desc">
            <Localized k="workspace.interface.description_526e008" />
          </label>
          <textarea id="ws-desc" className="textarea" rows={2} value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <ErrorLine text={save.error} />
        <div>
          <button className="btn btn-primary btn-sm" disabled={!dirty || !name.trim() || save.busy}>
            {save.busy ? l10n("common.common_saving") : l10n("common.actions.save")}
          </button>
        </div>
      </form>
    </Card>
  );
}
function Membership({ detail }: { detail: OrgAdminDetail }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const { org, permissions: can } = detail;
  const leave = useAction();
  const [confirm, setConfirm] = useState<"leave" | "delete" | null>(null);
  return (
    <Card title={uiText("workspace.interface.your_membership_d199e95")} sub={uiText("workspace.interface.leaving_removes_you_from_this_community_s_channels_and_voice_room_21746fe")}>
      <ErrorLine text={leave.error} />
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-danger-quiet btn-sm" disabled={!can.canLeave || leave.busy} onClick={() => setConfirm("leave")}>
          <Localized k="organization.interface.leave_community_6187cbc" slots={[<LogOut size={14} />]} />
        </button>
        {can.isOwner && (
          <button className="btn btn-danger-quiet btn-sm" onClick={() => setConfirm("delete")}>
            <Localized k="workspace.interface.delete_community_fed0f6a" slots={[<Trash2 size={14} />]} />
          </button>
        )}
      </div>
      {!can.canLeave && (
        <p className="faint" style={{ margin: 0, fontSize: 13 }}>
          <Localized k="workspace.interface.you_re_the_only_owner_make_someone_else_an_owner_people_before_yo_3e0b0ec" />
        </p>
      )}
      {confirm === "leave" && (
        <Dialog title={uiText("organization.interface.leave_value0_9c1e1f8", { value0: org.name })} onClose={() => setConfirm(null)}>
          <div className="dialog-body">
            <p style={{ margin: 0 }}>
              <Localized k="workspace.interface.you_ll_stop_seeing_its_channels_to_come_back_you_ll_need_a_new_in_35e86d8" />
            </p>
            <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setConfirm(null)}>
                {l10n("common.actions.cancel")}
              </button>
              <button
                className="btn btn-danger"
                disabled={leave.busy}
                onClick={() =>
                  void leave.act(async () => {
                    await leaveWorkspace(engine, org.id);
                    setConfirm(null);
                    setPrefs({ orgId: null });
                    navigate({ section: "home" });
                  })
                }
              >
                <Localized k="messaging.interface.leave_fc6e4a4" />
              </button>
            </div>
          </div>
        </Dialog>
      )}
      {confirm === "delete" && <DeleteCommunityDialog orgId={org.id} name={org.name} onClose={() => setConfirm(null)} />}
    </Card>
  );
}
