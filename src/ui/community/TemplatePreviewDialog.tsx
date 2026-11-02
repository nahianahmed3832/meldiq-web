import { LayoutTemplate, Users } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { ApiError } from "../../api/client";
import type { TemplatePreview } from "../../api/discoverySchemas";
import { useEngine } from "../../application/orbit";
import { setPrefs } from "../../application/prefs";
import { navigate } from "../../application/router";
import { createCommunity } from "../../sync/community";
import { templatePreview } from "../../sync/discovery/api";
import { requestId } from "../../sync/workspaces";
import { Dialog } from "../components/Overlay";
import { OrgAvatar } from "../components/OrgAvatar";
import { useLoad } from "../workspace/useLoad";
import { ChannelGlyph } from "./ChannelDialogs";

const NAME_MAX = 100;

const loadError = (e: string | null) => (e ? `${e} Ask whoever shared the link for a new one.` : null);

/**
 * A template link opened (community parity E, feature template-links; /template/<code>, a link in a chat, or pasted in
 * Start a community): the channels and roles a new community would start with, then a name and Create. The server
 * copies the template; you own the new community and are in every channel.
 */
export function TemplatePreviewDialog({ code, onClose }: { code: string; onClose: () => void }) {
  const engine = useEngine();
  const preview = useLoad(() => templatePreview(engine, code), [engine, code]);
  return (
    <Dialog title="Create a community from this template" subtitle="Its channels, categories, roles and permissions. Never messages or members." onClose={onClose} wide className="create-dialog">
      <div className="dialog-body">
        {preview.error && (
          <div className="banner danger" role="alert">
            {loadError(preview.error)}
          </div>
        )}
        {!preview.data && !preview.error && <span className="skeleton" style={{ height: 220 }} aria-busy="true" />}
        {preview.data && <TemplateBody template={preview.data} onClose={onClose} />}
      </div>
    </Dialog>
  );
}

function TemplateBody({ template, onClose }: { template: TemplatePreview; onClose: () => void }) {
  const engine = useEngine();
  const reqId = useMemo(requestId, []);
  const [name, setName] = useState(template.name.slice(0, NAME_MAX));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { counts } = template;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Give the community a name.");
    setBusy(true);
    setError(null);
    try {
      const org = await createCommunity(engine, { name, description: null, templateCode: template.code }, reqId);
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
    <form className="template-preview" onSubmit={(e) => void submit(e)} noValidate>
      <div className="row" style={{ gap: 12, alignItems: "center" }}>
        {template.source ? (
          <OrgAvatar orgId={template.source.id} name={template.source.name} photoRev={template.source.photoRev} size={48} />
        ) : (
          <span className="template-icon" aria-hidden="true">
            <LayoutTemplate size={24} />
          </span>
        )}
        <div className="grow">
          <strong className="template-name">{template.name}</strong>
          <div className="muted" style={{ fontSize: 13 }}>
            {template.source ? `From ${template.source.name} · ` : ""}
            {counts.channels} {counts.channels === 1 ? "channel" : "channels"} · {counts.roles} {counts.roles === 1 ? "role" : "roles"} · <Users size={12} aria-hidden="true" /> used {template.uses}{" "}
            {template.uses === 1 ? "time" : "times"}
          </div>
        </div>
      </div>
      <section className="template-channels" aria-label="Channels">
        {template.categories.map((cat, i) => (
          <div key={`${cat.name ?? ""}-${i}`} className="template-category">
            {cat.name && <h4>{cat.name}</h4>}
            <ul>
              {cat.channels.map((ch, j) => (
                <li key={`${ch.name}-${j}`} title={ch.topic ?? undefined}>
                  <ChannelGlyph kind={ch.kind} voice={ch.voice} format={ch.format} size={14} /> <span className="ellipsis">{ch.name}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
      {template.roles.length > 0 && (
        <section aria-label="Roles">
          <h4 className="ws-subhead">Roles</h4>
          <div className="chips">
            {template.roles.map((r, i) => (
              <span key={`${r.name}-${i}`} className="chip">
                <span className="role-dot" style={{ background: r.color ?? "var(--text-3)" }} aria-hidden="true" /> {r.name}
              </span>
            ))}
          </div>
        </section>
      )}
      {error && (
        <div className="banner danger" role="alert">
          {error}
        </div>
      )}
      <div className="field">
        <label htmlFor="tpl-name">Community name</label>
        <input id="tpl-name" className="input" data-autofocus value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={busy || !name.trim()}>
          {busy ? "Creating…" : "Create community"}
        </button>
      </div>
    </form>
  );
}
