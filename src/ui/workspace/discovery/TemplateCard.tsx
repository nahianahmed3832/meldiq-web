import { confirmAction } from "../../components/ConfirmationDialog";
import { countLabel } from "../../../i18n/counts";
import { useLocaleRender } from "../../../i18n/Localized";
import { text as uiText } from "../../../i18n";
import { Localized } from "../../../i18n/Localized";
import { useT as useLocalization } from "../../../i18n";
import { Link2, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { OwnTemplate } from "../../../api/discoverySchemas";
import { useEngine } from "../../../application/orbit";
import { createTemplate, deleteTemplate, ownTemplate, syncTemplate } from "../../../sync/discovery/api";
import { templateLink } from "../../../sync/discovery/rules";
import { CopyButton } from "../../components/CopyButton";
import { relative } from "../../format";
import { useAction, useLoad } from "../useLoad";
import { Card, ErrorLine } from "../../components/SettingsCard";
const TEMPLATE_NAME_MAX = 100;
/**
 * Profile › Community template (community parity E, feature template-links; the reference's "Create template link"):
 * a link anyone can use to start a community with this one's channels, roles and permissions. Never its messages,
 * members or pictures. One per community: sync it after changes, or delete it so the link stops working.
 */
export function TemplateCard({ orgId, communityName }: { orgId: string; communityName: string }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const loaded = useLoad(() => ownTemplate(engine, orgId), [engine, orgId]);
  const [template, setTemplate] = useState<OwnTemplate | null>(null);
  useEffect(() => setTemplate(loaded.data), [loaded.data]);
  const [name, setName] = useState("");
  const act = useAction();
  const sub = uiText("workspace.interface.a_link_that_starts_a_new_community_with_this_one_s_channels_categ_a15f2ec");
  if (loaded.loading && !loaded.data) return <Card title={uiText("workspace.interface.community_template_43006da")} sub={sub} />;
  return (
    <Card title={uiText("workspace.interface.community_template_43006da")} sub={sub}>
      <ErrorLine text={loaded.error ?? act.error} />
      {template ? (
        <TemplateLink
          template={template}
          busy={act.busy}
          onSync={() => void act.act(async () => setTemplate(await syncTemplate(engine, orgId)))}
          onDelete={async () => {
            if (!(await confirmAction(uiText("workspace.interface.delete_the_template_its_link_stops_working_communities_already_ma_47bbede")))) return;
            void act.act(async () => {
              await deleteTemplate(engine, orgId);
              setTemplate(null);
            });
          }}
        />
      ) : (
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <input
            className="input grow"
            style={{ flex: "1 1 200px" }}
            aria-label={uiText("workspace.interface.template_name_7b905ed")}
            placeholder={communityName}
            maxLength={TEMPLATE_NAME_MAX}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn btn-primary btn-sm" disabled={act.busy} onClick={() => void act.act(async () => setTemplate(await createTemplate(engine, orgId, name)))}>
            <Link2 size={14} /> {act.busy ? l10n("auth.signup_busy") : uiText("workspace.interface.create_template_link_891b284")}
          </button>
        </div>
      )}
    </Card>
  );
}
interface TemplateLinkProps {
  template: OwnTemplate;
  busy: boolean;
  onSync: () => void;
  onDelete: () => void;
}
function TemplateLink({ template, busy, onSync, onDelete }: TemplateLinkProps) {
  useLocaleRender();
  const link = templateLink(template.code);
  const { categories, channels, roles } = template.counts;
  return (
    <div className="template-own">
      <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <code className="template-link ellipsis grow">{link}</code>
        <CopyButton text={link} label={uiText("workspace.interface.copy_the_template_link_99a38de")} />
      </div>
      <small className="faint">
        <Localized
          k="workspace.interface.native_count_72faf9446"
          slots={[
            <strong>{template.name}</strong>,
            countLabel(categories, "categories"),
            "",
            countLabel(channels, "channels"),
            "",
            countLabel(roles, "roles"),
            "",
            template.uses,
            template.uses === 1 ? uiText("organization.interface.time_3360748") : uiText("organization.interface.times_2bf61a3"),
            relative(template.updatedAt),
          ]}
        />
      </small>
      {template.outOfDate && (
        <p className="banner" role="status">
          <Localized k="workspace.interface.the_community_changed_since_this_copy_sync_it_so_new_communities_132beee" />
        </p>
      )}
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={onSync}>
          <Localized k="workspace.interface.sync_template_94251e8" slots={[<RefreshCw size={14} />]} />
        </button>
        <button className="btn btn-danger-quiet btn-sm" disabled={busy} onClick={onDelete}>
          <Localized k="workspace.interface.delete_template_cc6f67a" slots={[<Trash2 size={14} />]} />
        </button>
      </div>
    </div>
  );
}
