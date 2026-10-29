import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { PARITY_FEATURES } from "../../sync/communityParity";
import { saveCommunitySettings } from "../../sync/communitySettings";
import { ACCENT_CLASS, ACCENT_PRESETS, accentStyle, isAccent, tintStyle } from "../community/accent";
import { AppearanceCard } from "./AppearanceCard";
import { useAction } from "./useLoad";
import { Card, ErrorLine } from "./WorkspaceView";

interface ThemePageProps {
  detail: OrgAdminDetail;
  onChanged: () => void;
}

/** Community settings › Theme: the accent and banner (Appearance), then the background tint (community-settings). */
export function ThemePage({ detail, onChanged }: ThemePageProps) {
  const tint = useOrbit((s) => s.server?.features.includes(PARITY_FEATURES.settings) ?? false);
  return (
    <div className="ws-page">
      <AppearanceCard detail={detail} onChanged={onChanged} />
      {tint && detail.permissions.canManageOrg && <TintCard detail={detail} onChanged={onChanged} />}
    </div>
  );
}

/** A soft colour behind the community's channels, from the accent's swatches or any colour, with a preview. */
function TintCard({ detail, onChanged }: ThemePageProps) {
  const engine = useEngine();
  const { org } = detail;
  const stored = org.background ?? null;
  const [tint, setTint] = useState<string | null>(stored);
  const [hex, setHex] = useState(stored ?? "");
  const save = useAction();
  useEffect(() => {
    setTint(stored);
    setHex(stored ?? "");
  }, [stored]);
  const choose = (v: string | null) => {
    setTint(v);
    setHex(v ?? "");
  };
  const hexOk = hex === "" || isAccent(hex);
  return (
    <Card title="Background tint" sub="A light wash of colour behind this community's channels. Members can turn community themes off in their Appearance settings.">
      <div className={`tint-preview${org.accent ? ` ${ACCENT_CLASS}` : ""}`} style={{ ...accentStyle(org.accent), ...tintStyle(tint) }} aria-label="Preview">
        <div className="tint-preview-rail" aria-hidden="true">
          <span># general</span>
          <span># clips</span>
          <span>🔊 Lounge</span>
        </div>
        <div className="tint-preview-chat" aria-hidden="true">
          <p>
            <strong>Ada</strong> check out this <span className="tint-preview-link">link</span>
          </p>
          <span className="brand-preview-btn">Button</span>
        </div>
      </div>
      <fieldset className="brand-swatches">
        <legend>Tint</legend>
        <button type="button" className="brand-swatch meldiq" aria-pressed={tint === null} onClick={() => choose(null)} title="No tint">
          {tint === null && <Check size={14} aria-hidden="true" />}
          <span className="sr-only">No tint</span>
        </button>
        {ACCENT_PRESETS.map((p) => (
          <button key={p.hex} type="button" className="brand-swatch" style={{ background: p.hex }} aria-pressed={tint === p.hex} onClick={() => choose(p.hex)} title={p.name}>
            {tint === p.hex && <Check size={14} aria-hidden="true" />}
            <span className="sr-only">{p.name}</span>
          </button>
        ))}
        <label className="brand-custom">
          <input type="color" value={isAccent(tint) ? tint : "#3a5bd9"} onChange={(e) => choose(e.target.value.toLowerCase())} aria-label="Pick any tint colour" />
          <input
            className="input mono"
            value={hex}
            maxLength={7}
            placeholder="#22d3ee"
            onChange={(e) => {
              const v = e.target.value.trim();
              setHex(v);
              if (isAccent(v)) setTint(v.toLowerCase());
              if (v === "") setTint(null);
            }}
            aria-label="Tint as #rrggbb"
            aria-invalid={!hexOk}
            spellCheck={false}
          />
        </label>
      </fieldset>
      {!hexOk && (
        <p className="field-error" role="alert">
          Use six hex digits, like #22d3ee.
        </p>
      )}
      <ErrorLine text={save.error} />
      <div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={save.busy || !hexOk || tint === stored}
          onClick={() => void save.act(() => saveCommunitySettings(engine, org.id, { background: tint }).then(onChanged))}
        >
          {save.busy ? "Saving…" : "Save tint"}
        </button>
      </div>
    </Card>
  );
}
