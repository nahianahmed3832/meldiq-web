import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { PARITY_FEATURES } from "../../sync/communityParity";
import { saveCommunitySettings } from "../../sync/communitySettings";
import { ACCENT_CLASS, ACCENT_PRESETS, accentStyle, isAccent, tintStyle } from "../community/accent";
import { AppearanceCard } from "./AppearanceCard";
import { useAction } from "./useLoad";
import { useUnsavedChanges } from "../components/UnsavedChanges";
import { Card, ErrorLine } from "../components/SettingsCard";
interface ThemePageProps {
  detail: OrgAdminDetail;
  onChanged: () => void;
}
/** Community settings › Theme: the accent and banner (Appearance), then the background tint (community-settings). */
export function ThemePage({ detail, onChanged }: ThemePageProps) {
  useLocaleRender();
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
  useLocaleRender();
  const l10n = useLocalization();
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
  useUnsavedChanges(tint !== stored || !hexOk);
  return (
    <Card title={uiText("workspace.interface.background_tint_4988e0f")} sub={uiText("workspace.interface.a_light_wash_of_colour_behind_this_community_s_channels_members_c_19c9adb")}>
      <div className={`tint-preview${org.accent ? ` ${ACCENT_CLASS}` : ""}`} style={{ ...accentStyle(org.accent), ...tintStyle(tint) }} aria-label={uiText("organization.interface.preview_324b134")}>
        <div className="tint-preview-rail" aria-hidden="true">
          <span>{"# general"}</span>
          <span>{"# clips"}</span>
          <span>
            <Localized k="auth.interface.lounge_e601919" />
          </span>
        </div>
        <div className="tint-preview-chat" aria-hidden="true">
          <p>
            <Localized
              k="workspace.interface.check_out_this_c97f757"
              slots={[
                <strong>
                  <Localized k="workspace.interface.ada_99a563a" />
                </strong>,
                <span className="tint-preview-link">
                  <Localized k="messaging.interface.link_b1b1bdb" />
                </span>,
              ]}
            />
          </p>
          <span className="brand-preview-btn">
            <Localized k="workspace.interface.button_707eab0" />
          </span>
        </div>
      </div>
      <fieldset className="brand-swatches">
        <legend>
          <Localized k="workspace.interface.tint_6a822da" />
        </legend>
        <button type="button" className="brand-swatch meldiq" aria-pressed={tint === null} onClick={() => choose(null)} title={uiText("workspace.interface.no_tint_ac86605")}>
          {tint === null && <Check size={14} aria-hidden="true" />}
          <span className="sr-only">
            <Localized k="workspace.interface.no_tint_ac86605" />
          </span>
        </button>
        {ACCENT_PRESETS.map((p) => (
          <button key={p.hex} type="button" className="brand-swatch" style={{ background: p.hex }} aria-pressed={tint === p.hex} onClick={() => choose(p.hex)} title={p.name}>
            {tint === p.hex && <Check size={14} aria-hidden="true" />}
            <span className="sr-only">{p.name}</span>
          </button>
        ))}
        <label className="brand-custom">
          <input
            type="color"
            value={isAccent(tint) ? tint : "#3a5bd9"}
            onChange={(e) => choose(e.target.value.toLowerCase())}
            aria-label={uiText("workspace.interface.pick_any_tint_colour_035b86e")}
          />
          <input
            className="input mono"
            value={hex}
            maxLength={7}
            placeholder={"#22d3ee"}
            onChange={(e) => {
              const v = e.target.value.trim();
              setHex(v);
              if (isAccent(v)) setTint(v.toLowerCase());
              if (v === "") setTint(null);
            }}
            aria-label={uiText("workspace.interface.tint_as_rrggbb_35bd880")}
            aria-invalid={!hexOk}
            spellCheck={false}
          />
        </label>
      </fieldset>
      {!hexOk && (
        <p className="field-error" role="alert">
          <Localized k="workspace.interface.use_six_hex_digits_like_22d3ee_a89ee06" />
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
          {save.busy ? l10n("common.common_saving") : uiText("workspace.interface.save_tint_c2ad256")}
        </button>
      </div>
    </Card>
  );
}
