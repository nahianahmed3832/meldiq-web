import { countLabel } from "../../i18n/counts";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
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
const loadError = (e: string | null) => (e ? uiText("organization.interface.value0_ask_whoever_shared_the_link_for_a_new_one_0dcdb9b", { value0: e }) : null);
/**
 * A template link opened (community parity E, feature template-links; /template/<code>, a link in a chat, or pasted in
 * Start a community): the channels and roles a new community would start with, then a name and Create. The server
 * copies the template; you own the new community and are in every channel.
 */
export function TemplatePreviewDialog({ code, onClose }: { code: string; onClose: () => void }) {
  useLocaleRender();
  const engine = useEngine();
  const preview = useLoad(() => templatePreview(engine, code), [engine, code]);
  return (
    <Dialog
      title={uiText("organization.interface.create_a_community_from_this_template_81ee2f3")}
      subtitle={uiText("organization.interface.its_channels_categories_roles_and_permissions_never_messages_or_m_b1bf4fd")}
      onClose={onClose}
      wide
      className="create-dialog"
    >
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
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const reqId = useMemo(requestId, []);
  const [name, setName] = useState(template.name.slice(0, NAME_MAX));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { counts } = template;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError(uiText("organization.interface.give_the_community_a_name_789d631"));
    setBusy(true);
    setError(null);
    try {
      const org = await createCommunity(engine, { name, description: null, templateCode: template.code }, reqId);
      setPrefs({ orgId: org.id });
      onClose();
      navigate({ section: "home" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : uiText("organization.interface.couldn_t_create_the_community_1d96bd2"));
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
            <Localized
              k="organization.interface.native_count_aaf3cc61c"
              slots={[
                template.source ? uiText("organization.interface.from_value0_d1f594c", { value0: template.source.name }) : "",
                countLabel(counts.channels, "channels"),
                "",
                countLabel(counts.roles, "roles"),
                "",
                <Users size={12} aria-hidden="true" />,
                template.uses,
                template.uses === 1 ? uiText("organization.interface.time_3360748") : uiText("organization.interface.times_2bf61a3"),
              ]}
            />
          </div>
        </div>
      </div>
      <section className="template-channels" aria-label={l10n("organization.channels")}>
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
        <section aria-label={l10n("organization.roles")}>
          <h4 className="ws-subhead">{l10n("organization.roles")}</h4>
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
        <label htmlFor="tpl-name">
          <Localized k="organization.interface.community_name_0565934" />
        </label>
        <input id="tpl-name" className="input" data-autofocus value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          {l10n("common.actions.cancel")}
        </button>
        <button className="btn btn-primary" disabled={busy || !name.trim()}>
          {busy ? l10n("auth.signup_busy") : uiText("organization.interface.create_community_5d6da55")}
        </button>
      </div>
    </form>
  );
}
