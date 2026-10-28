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
    if (!name.trim()) return setError(community ? "Give the community a name." : "Give the community a name.");
    setBusy(true);
    setError(null);
    try {
      const org = await createWorkspace(engine, name, description || null, reqId, community ? "community" : "team");
      setPrefs({ orgId: org.id });
      onClose();
      navigate({ section: "workspace", workspacePage: "invitations" });
    } catch (err) {
      setError(errorText(err, community ? "Couldn't create the community." : "Couldn't create the community."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title={community ? "Start a community" : "Create a community"} onClose={onClose}>
      <form className="dialog-body" onSubmit={(e) => void submit(e)} noValidate>
        {communities && (
          <div className="kind-choice" role="radiogroup" aria-label="What is it for?">
            <button type="button" role="radio" aria-checked={!community} className="kind-option" onClick={() => setKind("team")}>
              <Building2 size={18} aria-hidden />
              <span>
                <strong>Team</strong>
                <small>Colleagues working together: branches, teams and admin tools</small>
              </span>
            </button>
            <button type="button" role="radio" aria-checked={community} className="kind-option" onClick={() => setKind("community")}>
              <Users size={18} aria-hidden />
              <span>
                <strong>Community</strong>
                <small>People with a shared interest: channels, voice rooms and open invitations</small>
              </span>
            </button>
          </div>
        )}
        <p className="muted" style={{ margin: 0 }}>
          {community
            ? "It starts with #welcome, #announcements, #general, #introductions and a lounge to talk in. You'll run it and can invite people next."
            : "A community holds your organisation's channels, branches and teams. You'll be its owner and can invite people next."}
        </p>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <div className="field">
          <label htmlFor="cw-name">Name</label>
          <input id="cw-name" className="input" data-autofocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder={community ? "Dhaka Makers" : "Acme Inc."} />
        </div>
        <div className="field">
          <label htmlFor="cw-desc">Description (optional)</label>
          <input id="cw-desc" className="input" value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {community ? <Users size={16} /> : <Building2 size={16} />} {busy ? "Creating…" : community ? "Create community" : "Create community"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** Joins a workspace with an invitation code: shows what it is first (preview), then accepts. */
export function JoinWorkspaceDialog({ onClose, initialCode }: { onClose: () => void; initialCode?: string }) {
  const engine = useEngine();
  const [code, setCode] = useState(initialCode ?? "");
  const community = useOrbit((s) => s.server?.features.includes("community-channels") ?? false);
  const noun = community ? "community" : "workspace";
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = async (e?: FormEvent, raw = code) => {
    e?.preventDefault();
    // A pasted invite link or invite message works as well as the code itself (android InviteCodes).
    const typed = checkInvite(raw);
    const c = extractInvite(raw) ?? (typed.kind === "ok" ? typed.code : null);
    if (!c) return setError(typed.kind === "invalid" ? typed.reason : "Enter the invitation code you were given.");
    setCode(c);
    setBusy(true);
    setError(null);
    try {
      setPreview(await previewInvite(engine, c));
    } catch (err) {
      setError(errorText(err, "Couldn't check that code."));
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
      setError(errorText(err, `Couldn't join the ${noun}.`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title={preview ? `Join ${preview.org.name}` : `Join a ${noun}`} onClose={onClose} className={preview ? "invite-landing-dialog" : undefined}>
      <div className="dialog-body">
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        {!preview ? (
          <form onSubmit={(e) => void check(e)} style={{ display: "grid", gap: 14 }} noValidate>
            <div className="field">
              <label htmlFor="jw-code">Invitation code</label>
              <input id="jw-code" className="input mono" data-autofocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABCD-EFGH-JKLM" autoComplete="off" spellCheck={false} />
              <span className="hint">Ask a member for one. You can paste the whole invite message or link.</span>
            </div>
            <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button className="btn btn-primary" disabled={busy}>
                <Ticket size={16} /> {busy ? "Checking…" : "Continue"}
              </button>
            </div>
          </form>
        ) : (
          <div className={`invite-landing${preview.org.accent ? ` ${ACCENT_CLASS}` : ""}`} style={accentStyle(preview.org.accent)}>
            <InviteBanner code={extractInvite(code) ?? cleanInviteCode(code)} rev={preview.org.bannerRev} accent={preview.org.accent} />
            <span className="invite-landing-icon">
              <OrgAvatar orgId={preview.org.id} name={preview.org.name} photoRev={null} size={88} />
            </span>
            <p className="invite-landing-lead">You've been invited to join</p>
            <h3 className="invite-landing-name">{preview.org.name}</h3>
            {preview.org.memberCount !== undefined && (
              <p className="invite-landing-members">
                <i aria-hidden="true" />
                {preview.org.memberCount === 1 ? "1 member" : `${preview.org.memberCount} members`}
              </p>
            )}
            {preview.org.description && <p className="muted invite-landing-about">{preview.org.description}</p>}
            {!preview.alreadyMember && (
              <p className="faint invite-landing-role">
                You'll join as {roleName(preview.role).toLowerCase()}
                {preview.branch ? ` in ${preview.branch.name}` : ""}
                {preview.team ? `, team ${preview.team.name}` : ""}.
              </p>
            )}
            {!preview.alreadyMember && preview.banned && <div className="banner danger">You've been banned from this {noun}, so you can't join it.</div>}
            {!preview.alreadyMember && !preview.banned && preview.invitesPaused && <div className="banner warn">This {noun} has paused new members for now. Try again later.</div>}
            <button className="btn btn-primary btn-lg invite-landing-go" disabled={busy || (!preview.alreadyMember && (preview.banned || preview.invitesPaused))} onClick={() => void join()}>
              {busy ? "Joining…" : preview.alreadyMember ? "You're already in. Open it" : `Join ${preview.org.name}`}
            </button>
            <button type="button" className="link-btn" onClick={() => setPreview(null)}>
              Use a different code
            </button>
          </div>
        )}
      </div>
    </Dialog>
  );
}

/** The invited community's banner (API 0.44.0), or a band in its accent; nothing for a community without either. */
function InviteBanner({ code, rev, accent }: { code: string; rev: number | null; accent: string | null }) {
  const url = usePhoto("inviteBanner", code, rev);
  if (!url && !accent) return null;
  return <div className="invite-landing-banner" style={url ? { backgroundImage: `url(${url})` } : { background: accentBand(accent ?? "") }} aria-hidden="true" />;
}
