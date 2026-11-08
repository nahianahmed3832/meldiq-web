import { useEffect, useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { useT } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { PARITY_FEATURES } from "../../sync/communityParity";
import { saveCommunitySettings } from "../../sync/communitySettings";
import { ACCENT_CLASS, ACCENT_PRESETS, accentStyle, isAccent, tintStyle } from "../community/accent";
import { ErrorLine } from "../components/SettingsCard";
import { useUnsavedChanges } from "../components/UnsavedChanges";
import { AppearanceCard } from "./AppearanceCard";
import { useAction } from "./useLoad";

interface ThemePageProps {
  detail: OrgAdminDetail;
  onChanged: () => void;
}

export function ThemePage(props: ThemePageProps) {
  const settings = useOrbit((s) => s.server?.features.includes(PARITY_FEATURES.settings) ?? false);
  return <div className="ws-page">{settings && props.detail.permissions.canManageOrg ? <ThemeForm {...props} /> : <AppearanceCard {...props} />}</div>;
}

function ThemeForm({ detail, onChanged }: ThemePageProps) {
  const t = useT();
  const engine = useEngine();
  const { id, accent: savedAccent, background: savedTint } = detail.org;
  const [accent, setAccent] = useState(savedAccent ?? "");
  const [tint, setTint] = useState(savedTint ?? "");
  const save = useAction();
  useEffect(() => {
    setAccent(savedAccent ?? "");
    setTint(savedTint ?? "");
  }, [savedAccent, savedTint]);
  const valid = (!accent || isAccent(accent)) && (!tint || isAccent(tint));
  const dirty = accent !== (savedAccent ?? "") || tint !== (savedTint ?? "");
  useUnsavedChanges(dirty);
  const previewAccent = isAccent(accent) ? accent : null;
  const previewTint = isAccent(tint) ? tint : null;
  return (
    <form
      className="ws-reference-theme"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid || !dirty || save.busy) return;
        void save.act(() =>
          saveCommunitySettings(engine, id, {
            ...(accent !== (savedAccent ?? "") ? { accent: accent || null } : {}),
            ...(tint !== (savedTint ?? "") ? { background: tint || null } : {}),
          }).then(onChanged),
        );
      }}
    >
      <p className="muted">{t("workspace.reference.themeHelp")}</p>
      <ThemeColor label={t("workspace.reference.accent")} help={t("workspace.reference.accentHelp")} value={accent} onChange={setAccent} />
      <ThemeColor label={t("workspace.interface.background_tint_4988e0f")} help={t("workspace.reference.tintHelp")} value={tint} onChange={setTint} />
      <div
        className={`tint-preview ws-theme-preview${previewAccent ? ` ${ACCENT_CLASS}` : ""}`}
        style={{ ...accentStyle(previewAccent), ...tintStyle(previewTint) }}
        aria-label={t("organization.interface.preview_324b134")}
      >
        <div className="ws-theme-preview-rail" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="tint-preview-rail" aria-hidden="true">
          <span># general</span>
          <span>
            # <Localized k="organization.interface.announcement_028cd1c" />
          </span>
          <span>{t("auth.interface.lounge_e601919")}</span>
        </div>
        <div className="tint-preview-chat">
          <strong>{t("workspace.reference.themePreview")}</strong>
          <span className="brand-preview-btn">{t("workspace.interface.button_707eab0")}</span>
        </div>
      </div>
      {!valid && (
        <p className="field-error" role="alert">
          {t("workspace.interface.use_six_hex_digits_like_22d3ee_a89ee06")}
        </p>
      )}
      <ErrorLine text={save.error} />
      <div>
        <button className="btn btn-primary" disabled={!valid || !dirty || save.busy}>
          {save.busy ? t("common.common_saving") : t("common.actions.save")}
        </button>
      </div>
    </form>
  );
}

function ThemeColor({ label, help, value, onChange }: { label: string; help: string; value: string; onChange: (value: string) => void }) {
  const t = useT();
  return (
    <fieldset className="ws-theme-colors">
      <legend>{label}</legend>
      <p className="muted">{help}</p>
      <div className="brand-swatches">
        <button type="button" className="brand-swatch meldiq" aria-pressed={value === ""} aria-label={t("workspace.reference.defaultColor", { label })} onClick={() => onChange("")}>
          ∅
        </button>
        {ACCENT_PRESETS.map(({ hex, name }) => (
          <button key={hex} type="button" className="brand-swatch" style={{ background: hex }} aria-pressed={value === hex} aria-label={`${label} · ${name}`} onClick={() => onChange(hex)} />
        ))}
        <label className="brand-custom">
          <input type="color" aria-label={t("workspace.reference.pickColor", { label })} value={isAccent(value) ? value : "#ff694a"} onChange={(event) => onChange(event.target.value)} />
          <input
            type="text"
            className="input mono"
            aria-label={t("workspace.reference.hexColor", { label })}
            aria-invalid={!!value && !isAccent(value)}
            maxLength={7}
            spellCheck={false}
            placeholder={"#rrggbb"}
            value={value}
            onChange={(event) => onChange(event.target.value.trim().toLowerCase())}
          />
        </label>
      </div>
    </fieldset>
  );
}
