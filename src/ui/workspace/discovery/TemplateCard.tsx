import { Link2, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { OwnTemplate } from "../../../api/discoverySchemas";
import { useEngine } from "../../../application/orbit";
import { createTemplate, deleteTemplate, ownTemplate, syncTemplate } from "../../../sync/discovery/api";
import { templateLink } from "../../../sync/discovery/rules";
import { CopyButton } from "../../components/CopyButton";
import { relative } from "../../format";
import { useAction, useLoad } from "../useLoad";
import { Card, ErrorLine } from "../WorkspaceView";

const TEMPLATE_NAME_MAX = 100;

/**
 * Profile › Community template (community parity E, feature template-links; the reference's "Create template link"):
 * a link anyone can use to start a community with this one's channels, roles and permissions. Never its messages,
 * members or pictures. One per community: sync it after changes, or delete it so the link stops working.
 */
export function TemplateCard({ orgId, communityName }: { orgId: string; communityName: string }) {
  const engine = useEngine();
  const loaded = useLoad(() => ownTemplate(engine, orgId), [engine, orgId]);
  const [template, setTemplate] = useState<OwnTemplate | null>(null);
  useEffect(() => setTemplate(loaded.data), [loaded.data]);
  const [name, setName] = useState("");
  const act = useAction();

  const sub = "A link that starts a new community with this one's channels, categories, roles and permissions. Messages, members and pictures never come along.";
  if (loaded.loading && !loaded.data) return <Card title="Community template" sub={sub} />;
  return (
    <Card title="Community template" sub={sub}>
      <ErrorLine text={loaded.error ?? act.error} />
      {template ? (
        <TemplateLink
          template={template}
          busy={act.busy}
          onSync={() => void act.act(async () => setTemplate(await syncTemplate(engine, orgId)))}
          onDelete={() => {
            if (!window.confirm("Delete the template? Its link stops working; communities already made from it stay as they are.")) return;
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
            aria-label="Template name"
            placeholder={communityName}
            maxLength={TEMPLATE_NAME_MAX}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn btn-primary btn-sm" disabled={act.busy} onClick={() => void act.act(async () => setTemplate(await createTemplate(engine, orgId, name)))}>
            <Link2 size={14} /> {act.busy ? "Creating…" : "Create template link"}
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
  const link = templateLink(template.code);
  const { categories, channels, roles } = template.counts;
  return (
    <div className="template-own">
      <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <code className="template-link ellipsis grow">{link}</code>
        <CopyButton text={link} label="Copy the template link" />
      </div>
      <small className="faint">
        <strong>{template.name}</strong> · {categories} {categories === 1 ? "category" : "categories"} · {channels} {channels === 1 ? "channel" : "channels"} · {roles} {roles === 1 ? "role" : "roles"}{" "}
        · used {template.uses} {template.uses === 1 ? "time" : "times"} · copied {relative(template.updatedAt)}
      </small>
      {template.outOfDate && (
        <p className="banner" role="status">
          The community changed since this copy. Sync it so new communities get the changes.
        </p>
      )}
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={onSync}>
          <RefreshCw size={14} /> Sync template
        </button>
        <button className="btn btn-danger-quiet btn-sm" disabled={busy} onClick={onDelete}>
          <Trash2 size={14} /> Delete template
        </button>
      </div>
    </div>
  );
}
