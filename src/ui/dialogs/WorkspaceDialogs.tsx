import { Building2, Ticket, Users } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { ApiError } from "../../api/client";
import type { InvitePreview } from "../../api/workspaceSchemas";
import { useEngine, useOrbit } from "../../app/orbit";
import type { OrgKind } from "../../api/schemas";
import { setPrefs } from "../../app/prefs";
import { navigate } from "../../app/router";
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
    if (!name.trim()) return setError(community ? "Give the community a name." : "Give the workspace a name.");
    setBusy(true);
    setError(null);
    try {
      const org = await createWorkspace(engine, name, description || null, reqId, community ? "community" : "team");
      setPrefs({ orgId: org.id });
      onClose();
      navigate({ section: "workspace", workspacePage: "invitations" });
    } catch (err) {
      setError(errorText(err, community ? "Couldn't create the community." : "Couldn't create the workspace."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title={community ? "Start a community" : "Create a workspace"} onClose={onClose}>
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
            : "A workspace holds your organisation's channels, branches and teams. You'll be its owner and can invite people next."}
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
            {community ? <Users size={16} /> : <Building2 size={16} />} {busy ? "Creating…" : community ? "Create community" : "Create workspace"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** Joins a workspace with an invitation code: shows what it is first (preview), then accepts. */
export function JoinWorkspaceDialog({ onClose }: { onClose: () => void }) {
  const engine = useEngine();
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = async (e: FormEvent) => {
    e.preventDefault();
    // A pasted invite link or invite message works as well as the code itself (android InviteCodes).
    const typed = checkInvite(code);
    const c = extractInvite(code) ?? (typed.kind === "ok" ? typed.code : null);
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

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      const org = await acceptInvite(engine, extractInvite(code) ?? cleanInviteCode(code));
      setPrefs({ orgId: org.id });
      onClose();
      navigate({ section: "home" });
    } catch (err) {
      setError(errorText(err, "Couldn't join the workspace."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title="Join a workspace" onClose={onClose}>
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
              <span className="hint">Ask a workspace owner or admin for one. You can paste the whole invite message or link.</span>
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
          <div style={{ display: "grid", gap: 14 }}>
            <div className="card" style={{ padding: 16, display: "grid", gap: 4 }}>
              <strong style={{ fontSize: 17 }}>{preview.org.name}</strong>
              {preview.org.description && <span className="muted">{preview.org.description}</span>}
              <span className="faint" style={{ fontSize: 13 }}>
                You'll join as {roleName(preview.role).toLowerCase()}
                {preview.branch ? ` in ${preview.branch.name}` : ""}
                {preview.team ? `, team ${preview.team.name}` : ""}.
              </span>
            </div>
            {preview.alreadyMember && <div className="banner info">You're already a member of this workspace.</div>}
            <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setPreview(null)}>
                Back
              </button>
              <button className="btn btn-primary" disabled={busy} onClick={() => void join()}>
                {busy ? "Joining…" : preview.alreadyMember ? "Open workspace" : "Join workspace"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
