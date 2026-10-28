import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "../../api/client";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine } from "../../application/orbit";
import { setCommunityTag } from "../../sync/workspaces";
import { WornTagChip } from "../people/NameStyle";
import { Card, ErrorLine } from "./WorkspaceView";

const TAG = /^[A-Z0-9]{2,4}$/;

/**
 * Community settings › Appearance › Tag (API 0.46.0): 2 to 4 letters or digits members may wear beside their names
 * everywhere (Settings › Profile › Name style), in the community's accent colour. Removing it takes it off everyone.
 */
export function TagCard({ detail, onChanged }: { detail: OrgAdminDetail; onChanged: () => void }) {
  const engine = useEngine();
  const { org } = detail;
  const canEdit = detail.permissions.canManageOrg;
  const [value, setValue] = useState(org.tag ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => setValue(org.tag ?? ""), [org.tag]);
  const next = value.trim().toUpperCase();
  const valid = next === "" || TAG.test(next);
  const dirty = next !== (org.tag ?? "");
  const save = (tag: string | null) => {
    setBusy(true);
    setError(null);
    setCommunityTag(engine, org.id, tag)
      .then(() => {
        setSaved(true);
        onChanged();
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Couldn't save the tag. Try again."))
      .finally(() => setBusy(false));
  };
  return (
    <Card title="Community tag" sub="Two to four letters or digits your members can show beside their names everywhere, in your accent colour.">
      <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          className="input mono"
          style={{ width: 110, textTransform: "uppercase" }}
          value={value}
          maxLength={4}
          placeholder="MC"
          disabled={!canEdit || busy}
          onChange={(e) => {
            setValue(e.target.value.replace(/[^A-Za-z0-9]/g, ""));
            setSaved(false);
          }}
          aria-label="Community tag"
          aria-invalid={!valid}
        />
        {next && valid && <WornTagChip tag={{ orgId: org.id, text: next, color: org.accent }} />}
        {canEdit && (
          <>
            <button type="button" className="btn btn-primary btn-sm" disabled={!dirty || !valid || busy} onClick={() => save(next || null)}>
              {busy ? "Saving…" : "Save tag"}
            </button>
            {org.tag && (
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => save(null)}>
                Remove tag
              </button>
            )}
          </>
        )}
        {saved && !dirty && (
          <span className="faint" role="status">
            <Check size={14} aria-hidden="true" /> Saved
          </span>
        )}
      </div>
      {!valid && (
        <p className="field-error" role="alert">
          Use 2 to 4 letters or digits.
        </p>
      )}
      {!canEdit && <small className="faint">Only owners and admins can change the tag.</small>}
      <ErrorLine text={error} />
    </Card>
  );
}
