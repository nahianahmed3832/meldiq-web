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
import { Card, ErrorLine } from "./WorkspaceView";
import { GuestPolicyCard } from "./WorkspaceSetupCards";
import { AccessCard, JoinQuestionsCard } from "./ModerationPages";
import { ProfileSafety } from "./ProfileSafety";
import { ProfileExtrasCards } from "./ProfileExtrasCards";
import { PARITY_FEATURES } from "../../sync/communityParity";
import { SETTINGS_LIMITS } from "../../sync/communitySettings";
import { DeleteCommunityDialog } from "../community/DeleteCommunityDialog";
import { TicketsSection } from "../community/tickets/TicketsCard";
import { DISCOVERY_FEATURES } from "../../sync/discovery/rules";
import { DiscoveryCard } from "./discovery/DiscoveryCard";
import { TemplateCard } from "./discovery/TemplateCard";

interface OverviewPageProps {
  detail: OrgAdminDetail;
  onChanged: () => void;
  /** Opened from an old Security actions link: show the safety section. */
  focusSafety?: boolean;
}

/**
 * Community settings › Profile (the reference's server profile): details, tag, who can find and join, safety, then
 * ownership and membership. A community's accent and banner live on Theme; older team servers keep them here.
 */
export function OverviewPage({ detail, onChanged, focusSafety = false }: OverviewPageProps) {
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
              ? `Community · ${roleName(org.myRole)} · ${stats.members} ${stats.members === 1 ? "member" : "members"} · ${stats.channels} channels`
              : `${roleName(org.myRole)} · ${stats.members} ${stats.members === 1 ? "member" : "members"} · ${stats.channels} channels · ${stats.branches} branches · ${stats.teams} teams`}
          </p>
        </div>
      </header>
      {can.canManageOrg ? <Identity detail={detail} onChanged={onChanged} /> : <ReadOnlyAbout description={org.description} />}
      {!community && features.includes("community-branding") && <AppearanceCard detail={detail} onChanged={onChanged} />}
      {features.includes("community-tags") && <TagCard detail={detail} onChanged={onChanged} />}
      {community && can.canManageOrg && features.includes(PARITY_FEATURES.settings) && <ProfileExtrasCards detail={detail} onChanged={onChanged} />}
      {community && can.canManageOrg && features.includes(DISCOVERY_FEATURES.templates) && <TemplateCard orgId={org.id} communityName={org.name} />}
      {community && <AccessCard detail={detail} />}
      {community && can.canManageOrg && features.includes(DISCOVERY_FEATURES.listing) && <DiscoveryCard orgId={org.id} />}
      {community && can.canManageOrg && features.includes("join-applications") && <JoinQuestionsCard detail={detail} />}
      {community && <ProfileSafety detail={detail} focused={focusSafety} />}
      {community && <TicketsSection detail={detail} />}
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
  const engine = useEngine();
  const { org } = detail;
  const owner = org.myRole === "OWNER";
  const save = useAction();
  const choose = (kind: OrgKind) => {
    if (!owner || kind === org.kind) return;
    void save.act(() => setWorkspaceKind(engine, org.id, kind).then(onChanged));
  };
  return (
    <Card title="Kind of community" sub={owner ? "Changes what Meldiq shows first. Nothing is added or removed." : "Only owners can change this."}>
      <ErrorLine text={save.error} />
      <div className="kind-choice" role="radiogroup" aria-label="Kind of community">
        {(["team", "community"] as const).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={org.kind === k} className="kind-option" disabled={!owner || save.busy} onClick={() => choose(k)}>
            <span>
              <strong>{k === "team" ? "Team" : "Community"}</strong>
              <small>{k === "team" ? "Colleagues working together: branches, teams and admin tools" : "People with a shared interest: channels, voice rooms and open invitations"}</small>
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}

function ReadOnlyAbout({ description }: { description: string | null }) {
  return (
    <Card title="About" sub="Only owners and admins can change the community's name, description and photo.">
      <p style={{ margin: 0 }}>{description || <span className="faint">No description.</span>}</p>
    </Card>
  );
}

function Identity({ detail, onChanged }: { detail: OrgAdminDetail; onChanged: () => void }) {
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
    <Card title={community ? "Community details" : "Community details"} sub="Members see the name, description and photo. They aren't end-to-end encrypted.">
      <div className="row" style={{ gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <OrgAvatar orgId={org.id} name={org.name} photoRev={org.photoRev} size={56} />
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
        <button className="btn btn-secondary btn-sm" disabled={photo.busy} onClick={() => file.current?.click()}>
          <Camera size={14} /> {org.photoRev ? "Change photo" : "Add photo"}
        </button>
        {animatedImages && <small className="faint">A GIF or WebP stays animated (up to 4 MB).</small>}
        {org.photoRev && (
          <button className="btn btn-ghost btn-sm" disabled={photo.busy} onClick={() => void photo.act(() => removeWorkspacePhoto(engine, org.id).then(onChanged))}>
            Remove
          </button>
        )}
      </div>
      <ErrorLine text={photo.error} />
      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <div className="field">
          <label htmlFor="ws-name">Name</label>
          <input id="ws-name" className="input" value={name} maxLength={nameMax} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ws-desc">Description</label>
          <textarea id="ws-desc" className="textarea" rows={2} value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <ErrorLine text={save.error} />
        <div>
          <button className="btn btn-primary btn-sm" disabled={!dirty || !name.trim() || save.busy}>
            {save.busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Card>
  );
}

function Membership({ detail }: { detail: OrgAdminDetail }) {
  const engine = useEngine();
  const { org, permissions: can } = detail;
  const leave = useAction();
  const [confirm, setConfirm] = useState<"leave" | "delete" | null>(null);
  return (
    <Card title="Your membership" sub="Leaving removes you from this community's channels and voice rooms. Your direct messages stay.">
      <ErrorLine text={leave.error} />
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-danger-quiet btn-sm" disabled={!can.canLeave || leave.busy} onClick={() => setConfirm("leave")}>
          <LogOut size={14} /> Leave community
        </button>
        {can.isOwner && (
          <button className="btn btn-danger-quiet btn-sm" onClick={() => setConfirm("delete")}>
            <Trash2 size={14} /> Delete community…
          </button>
        )}
      </div>
      {!can.canLeave && (
        <p className="faint" style={{ margin: 0, fontSize: 13 }}>
          You're the only owner. Make someone else an owner (People) before you leave.
        </p>
      )}
      {confirm === "leave" && (
        <Dialog title={`Leave ${org.name}?`} onClose={() => setConfirm(null)}>
          <div className="dialog-body">
            <p style={{ margin: 0 }}>You'll stop seeing its channels. To come back you'll need a new invitation.</p>
            <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setConfirm(null)}>
                Cancel
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
                Leave
              </button>
            </div>
          </div>
        </Dialog>
      )}
      {confirm === "delete" && <DeleteCommunityDialog orgId={org.id} name={org.name} onClose={() => setConfirm(null)} />}
    </Card>
  );
}
