import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Check, ImagePlus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../api/client";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { removeCommunityBanner, setCommunityAccent, setCommunityBanner } from "../../sync/workspaces";
import { ACCENT_CLASS, ACCENT_PRESETS, accentBand, accentStyle, isAccent } from "../community/accent";
import { OrgAvatar } from "../components/OrgAvatar";
import { usePhoto } from "../components/photos";
import { animatedUpload, bannerJpeg } from "./photo";
import { Card, ErrorLine } from "./WorkspaceView";
/** What the banner will be after Save: unchanged, a new picture (its bytes, a JPEG or an animated GIF/WebP, and a preview URL), or none. */
type BannerDraft =
  | {
      kind: "keep";
    }
  | {
      kind: "new";
      bytes: Uint8Array;
      url: string;
    }
  | {
      kind: "remove";
    };
/**
 * Community appearance (API 0.44.0, meldiq docs/COMMUNITY_BRANDING.md): an accent colour, from Meldiq's presets or any
 * #rrggbb, and a banner, previewed together before Save. Only this community changes; Meldiq's theme and every other
 * community stay as they are. People who can't edit the community see the preview only.
 */
export function AppearanceCard({ detail, onChanged }: { detail: OrgAdminDetail; onChanged: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const { org } = detail;
  const canEdit = detail.permissions.canManageOrg;
  const [accent, setAccent] = useState<string | null>(org.accent);
  const [hex, setHex] = useState(org.accent ?? "");
  const [banner, setBanner] = useState<BannerDraft>({ kind: "keep" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const currentBanner = usePhoto("banner", org.id, org.bannerRev);
  const animatedImages = useOrbit((s) => s.server?.features.includes("animated-community-images") ?? false);
  useEffect(() => {
    setAccent(org.accent);
    setHex(org.accent ?? "");
  }, [org.accent]);
  // The preview's object URL goes when it's replaced or the card closes.
  useEffect(() => () => void (banner.kind === "new" && URL.revokeObjectURL(banner.url)), [banner]);
  const hexOk = hex === "" || isAccent(hex);
  const dirty = accent !== org.accent || banner.kind !== "keep";
  const bannerUrl = banner.kind === "new" ? banner.url : banner.kind === "remove" ? null : currentBanner;
  const choose = (v: string | null) => {
    setAccent(v);
    setHex(v ?? "");
    setSaved(false);
  };
  const typed = (v: string) => {
    const next = v.startsWith("#") || v === "" ? v : `#${v}`;
    setHex(next);
    setSaved(false);
    if (next === "") setAccent(null);
    else if (isAccent(next)) setAccent(next.toLowerCase());
  };
  const pick = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    try {
      // API 0.64.0: an animated GIF or WebP goes up as it is; anything else is cropped to a 1200 × 480 JPEG.
      const animated = await animatedUpload(f, "banner", animatedImages);
      const bytes = animated ?? (await bannerJpeg(f));
      setBanner({ kind: "new", bytes, url: URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: animated ? f.type : "image/jpeg" })) });
      setSaved(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : uiText("workspace.interface.that_image_couldn_t_be_used_f036e54"));
    } finally {
      if (file.current) file.current.value = "";
    }
  };
  const cancel = () => {
    choose(org.accent);
    setBanner({ kind: "keep" });
    setError(null);
  };
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (accent !== org.accent) await setCommunityAccent(engine, org.id, accent);
      if (banner.kind === "new") await setCommunityBanner(engine, org.id, banner.bytes);
      if (banner.kind === "remove") await removeCommunityBanner(engine, org.id);
      setBanner({ kind: "keep" });
      setSaved(true);
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : uiText("workspace.interface.couldn_t_save_the_appearance_try_again_8be9772"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card
      title={l10n("settings.appearance")}
      sub={
        canEdit
          ? uiText("workspace.interface.an_accent_colour_and_a_banner_for_this_community_only_without_the_fe63325")
          : uiText("workspace.interface.only_owners_and_admins_can_change_the_accent_colour_and_banner_ab426c0")
      }
    >
      <div className={`brand-preview ${ACCENT_CLASS}`} style={accentStyle(accent)} aria-label={uiText("organization.interface.preview_324b134")}>
        <div className="brand-preview-banner" style={bannerUrl ? { backgroundImage: `url(${bannerUrl})` } : accent ? { background: accentBand(accent) } : undefined} />
        <div className="brand-preview-body">
          <span className="brand-preview-icon">
            <OrgAvatar orgId={org.id} name={org.name} photoRev={org.photoRev} size={52} />
          </span>
          <strong className="ellipsis">{org.name}</strong>
          <span className="brand-preview-row" aria-hidden="true">
            <span className="brand-preview-channel">{"# general"}</span>
            <span className="brand-preview-btn">{l10n("workspace.discover_join")}</span>
          </span>
        </div>
      </div>
      {canEdit && (
        <>
          <fieldset className="brand-swatches">
            <legend>
              <Localized k="workspace.interface.accent_colour_12376f4" />
            </legend>
            <button type="button" className="brand-swatch meldiq" aria-pressed={accent === null} onClick={() => choose(null)} title={uiText("workspace.interface.meldiq_s_colours_04bd0c0")}>
              {accent === null && <Check size={14} aria-hidden="true" />}
              <span className="sr-only">
                <Localized k="workspace.interface.meldiq_s_colours_04bd0c0" />
              </span>
            </button>
            {ACCENT_PRESETS.map((p) => (
              <button key={p.hex} type="button" className="brand-swatch" style={{ background: p.hex }} aria-pressed={accent === p.hex} onClick={() => choose(p.hex)} title={p.name}>
                {accent === p.hex && <Check size={14} aria-hidden="true" />}
                <span className="sr-only">{p.name}</span>
              </button>
            ))}
            <label className="brand-custom">
              <input
                type="color"
                value={isAccent(accent) ? accent : "#3a5bd9"}
                onChange={(e) => choose(e.target.value.toLowerCase())}
                aria-label={uiText("workspace.interface.pick_any_colour_3d657c8")}
              />
              <input
                className="input mono"
                value={hex}
                maxLength={7}
                placeholder={"#22d3ee"}
                onChange={(e) => typed(e.target.value.trim())}
                aria-label={uiText("workspace.interface.accent_colour_as_rrggbb_bb8f246")}
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
          <div className="brand-banner-actions">
            <input ref={file} type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files?.[0])} />
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => file.current?.click()}>
              <ImagePlus size={14} /> {bannerUrl ? uiText("settings.interface.change_banner_6ca1984") : uiText("settings.interface.add_banner_e7d7d97")}
            </button>
            {bannerUrl && (
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setBanner({ kind: "remove" })}>
                <Localized k="workspace.interface.remove_banner_ced5092" slots={[<Trash2 size={14} />]} />
              </button>
            )}
            <small className="faint">
              <Localized
                k="workspace.interface.cropped_to_5_2_1200_480_members_see_it_and_so_does_anyone_on_disc_bf482a1"
                slots={[animatedImages ? uiText("workspace.interface.a_gif_or_webp_stays_animated_up_to_6_mb_2153192") : ""]}
              />
            </small>
          </div>
          <ErrorLine text={error} />
          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <button type="button" className="btn btn-primary btn-sm" disabled={!dirty || !hexOk || busy} onClick={() => void save()}>
              {busy ? l10n("common.common_saving") : uiText("workspace.interface.save_appearance_cf157e9")}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={!dirty || busy} onClick={cancel}>
              {l10n("common.actions.cancel")}
            </button>
            {saved && !dirty && (
              <span className="faint" role="status">
                <Localized k="workspace.interface.saved_a3a4394" slots={[<Check size={14} aria-hidden="true" />]} />
              </span>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
