import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "../../api/client";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine } from "../../application/orbit";
import { setCommunityTag } from "../../sync/workspaces";
import { WornTagChip } from "../people/NameStyle";
import { Card, ErrorLine } from "../components/SettingsCard";
const TAG = /^[A-Z0-9]{2,4}$/;
/**
 * Community settings › Appearance › Tag (API 0.46.0): 2 to 4 letters or digits members may wear beside their names
 * everywhere (Settings › Profile › Name style), in the community's accent colour. Removing it takes it off everyone.
 */
export function TagCard({ detail, onChanged }: { detail: OrgAdminDetail; onChanged: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
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
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : uiText("workspace.interface.couldn_t_save_the_tag_try_again_212e577")))
      .finally(() => setBusy(false));
  };
  return (
    <Card title={uiText("settings.interface.community_tag_4f99271")} sub={uiText("workspace.interface.two_to_four_letters_or_digits_your_members_can_show_beside_their_5ce45e7")}>
      <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          className="input mono"
          style={{ width: 110, textTransform: "uppercase" }}
          value={value}
          maxLength={4}
          placeholder={"MC"}
          disabled={!canEdit || busy}
          onChange={(e) => {
            setValue(e.target.value.replace(/[^A-Za-z0-9]/g, ""));
            setSaved(false);
          }}
          aria-label={uiText("settings.interface.community_tag_4f99271")}
          aria-invalid={!valid}
        />
        {next && valid && <WornTagChip tag={{ orgId: org.id, text: next, color: org.accent }} />}
        {canEdit && (
          <>
            <button type="button" className="btn btn-primary btn-sm" disabled={!dirty || !valid || busy} onClick={() => save(next || null)}>
              {busy ? l10n("common.common_saving") : uiText("workspace.interface.save_tag_a90267d")}
            </button>
            {org.tag && (
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => save(null)}>
                <Localized k="workspace.interface.remove_tag_488464b" />
              </button>
            )}
          </>
        )}
        {saved && !dirty && (
          <span className="faint" role="status">
            <Localized k="workspace.interface.saved_a3a4394" slots={[<Check size={14} aria-hidden="true" />]} />
          </span>
        )}
      </div>
      {!valid && (
        <p className="field-error" role="alert">
          <Localized k="workspace.interface.use_2_to_4_letters_or_digits_6ffae49" />
        </p>
      )}
      {!canEdit && (
        <small className="faint">
          <Localized k="workspace.interface.only_owners_and_admins_can_change_the_tag_326227c" />
        </small>
      )}
      <ErrorLine text={error} />
    </Card>
  );
}
