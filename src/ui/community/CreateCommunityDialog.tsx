import { Users } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { ApiError } from "../../api/client";
import { useEngine, useOrbit } from "../../application/orbit";
import { setPrefs } from "../../application/prefs";
import { navigate } from "../../application/router";
import { communityTemplates, createCommunity } from "../../sync/community";
import { requestId } from "../../sync/workspaces";
import { Dialog } from "../components/Overlay";
import { useLoad } from "../workspace/useLoad";

/** The starter templates' names and what they're for (android CommunityTemplates; ids from the server). */
const TEMPLATE_TEXT: Record<string, { name: string; hint: string }> = {
  starter: { name: "Starter", hint: "Welcome, announcements, general chat, introductions and a lounge" },
  friends: { name: "Friends", hint: "General chat, photos, plans and a voice hangout" },
  gaming: { name: "Gaming", hint: "Looking for group, a clips forum and two voice channels" },
  study: { name: "Study group", hint: "Homework help, a resources forum and a study room" },
  club: { name: "Club", hint: "Introductions, an ideas forum and a meeting room" },
};

/**
 * Start a community (batch B2 starter templates, android CreateCommunitySheet): name, description, a template whose
 * categories and channels the server creates, and whether it's listed in Discover and open to join.
 */
export function CreateCommunityDialog({ onClose }: { onClose: () => void }) {
  const engine = useEngine();
  const reqId = useMemo(requestId, []);
  const hasTemplates = useOrbit((s) => s.server?.features.includes("community-templates") ?? false);
  const templates = useLoad(() => (hasTemplates ? communityTemplates(engine) : Promise.resolve([])), [engine, hasTemplates]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [template, setTemplate] = useState("starter");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [joinPolicy, setJoinPolicy] = useState<"invite" | "open">("invite");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = templates.data?.find((t) => t.id === template);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Give the community a name.");
    setBusy(true);
    setError(null);
    try {
      const org = await createCommunity(
        engine,
        { name, description: description || null, template: hasTemplates ? template : undefined, visibility, joinPolicy: visibility === "public" ? joinPolicy : "invite" },
        reqId,
      );
      setPrefs({ orgId: org.id });
      onClose();
      navigate({ section: "home" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create the community.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title="Start a community" onClose={onClose} wide>
      <form className="dialog-body" onSubmit={(e) => void submit(e)} noValidate>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <div className="field">
          <label htmlFor="cc-name">Name</label>
          <input id="cc-name" className="input" data-autofocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Dhaka Makers" />
        </div>
        <div className="field">
          <label htmlFor="cc-desc">Description (optional)</label>
          <input id="cc-desc" className="input" value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
        </div>
        {hasTemplates && (
          <div className="field">
            <span className="label">Start with</span>
            <div className="kind-choice template-choice" role="radiogroup" aria-label="Template">
              {(templates.data ?? []).map((t) => (
                <button key={t.id} type="button" role="radio" aria-checked={template === t.id} className="kind-option" onClick={() => setTemplate(t.id)}>
                  <span>
                    <strong>{TEMPLATE_TEXT[t.id]?.name ?? t.id}</strong>
                    <small>{TEMPLATE_TEXT[t.id]?.hint ?? t.categories.map((c) => c.name).join(", ")}</small>
                  </span>
                </button>
              ))}
            </div>
            {chosen && <span className="hint">{chosen.categories.map((c) => `${c.name}: ${c.channels.map((ch) => (ch.voice ? ch.name : `#${ch.name}`)).join(", ")}`).join(" · ")}</span>}
          </div>
        )}
        <div className="field">
          <span className="label">Who can find it</span>
          <div className="segmented" role="radiogroup" aria-label="Who can find it">
            <button type="button" role="radio" aria-checked={visibility === "private"} aria-pressed={visibility === "private"} onClick={() => setVisibility("private")}>
              Only people I invite
            </button>
            <button type="button" role="radio" aria-checked={visibility === "public"} aria-pressed={visibility === "public"} onClick={() => setVisibility("public")}>
              Listed in Discover
            </button>
          </div>
        </div>
        {visibility === "public" && (
          <div className="field">
            <span className="label">Who can join</span>
            <div className="segmented" role="radiogroup" aria-label="Who can join">
              <button type="button" role="radio" aria-checked={joinPolicy === "invite"} aria-pressed={joinPolicy === "invite"} onClick={() => setJoinPolicy("invite")}>
                With an invitation
              </button>
              <button type="button" role="radio" aria-checked={joinPolicy === "open"} aria-pressed={joinPolicy === "open"} onClick={() => setJoinPolicy("open")}>
                Anyone
              </button>
            </div>
          </div>
        )}
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            <Users size={16} /> {busy ? "Creating…" : "Create community"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
