import { Check } from "lucide-react";
import { useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { PARITY_FEATURES, setCommunityTint } from "../../sync/communityParity";
import { ACCENT_PRESETS } from "../community/accent";
import { AppearanceCard } from "./AppearanceCard";
import { useAction } from "./useLoad";
import { Card, ErrorLine } from "./WorkspaceView";

interface ThemePageProps {
  detail: OrgAdminDetail;
  onChanged: () => void;
}

/** Community settings › Theme: the accent and banner (Appearance), then a background tint once the server has one. */
export function ThemePage({ detail, onChanged }: ThemePageProps) {
  const tint = useOrbit((s) => s.server?.features.includes(PARITY_FEATURES.settingsPlus) ?? false);
  return (
    <div className="ws-page">
      <AppearanceCard detail={detail} onChanged={onChanged} />
      {tint && detail.permissions.canManageOrg && <TintCard orgId={detail.org.id} />}
    </div>
  );
}

/**
 * A soft colour behind the community's channels, from the same swatches as the accent.
 * TODO(community-parity A): start from the org's backgroundTint (CommunityParityFields) once zOrg reads it; members can
 * turn community themes off in their own Appearance settings.
 */
function TintCard({ orgId }: { orgId: string }) {
  const engine = useEngine();
  const [tint, setTint] = useState<string | null>(null);
  const save = useAction();
  return (
    <Card title="Background tint" sub="A light wash of colour behind this community's channels. Members can turn community themes off.">
      <fieldset className="brand-swatches">
        <legend>Tint</legend>
        <button type="button" className="brand-swatch meldiq" aria-pressed={tint === null} onClick={() => setTint(null)} title="No tint">
          {tint === null && <Check size={14} aria-hidden="true" />}
          <span className="sr-only">No tint</span>
        </button>
        {ACCENT_PRESETS.map((p) => (
          <button key={p.hex} type="button" className="brand-swatch" style={{ background: p.hex }} aria-pressed={tint === p.hex} onClick={() => setTint(p.hex)} title={p.name}>
            {tint === p.hex && <Check size={14} aria-hidden="true" />}
            <span className="sr-only">{p.name}</span>
          </button>
        ))}
      </fieldset>
      <ErrorLine text={save.error} />
      <div>
        <button type="button" className="btn btn-primary btn-sm" disabled={save.busy} onClick={() => void save.act(() => setCommunityTint(engine, orgId, tint))}>
          {save.busy ? "Saving…" : "Save tint"}
        </button>
      </div>
    </Card>
  );
}
