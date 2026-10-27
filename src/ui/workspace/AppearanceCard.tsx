import { Check, ImagePlus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../api/client";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine } from "../../application/orbit";
import { removeCommunityBanner, setCommunityAccent, setCommunityBanner } from "../../sync/workspaces";
import { ACCENT_CLASS, ACCENT_PRESETS, accentBand, accentStyle, isAccent } from "../community/accent";
import { OrgAvatar } from "../components/OrgAvatar";
import { usePhoto } from "../components/photos";
import { bannerJpeg } from "./photo";
import { Card, ErrorLine } from "./WorkspaceView";

/** What the banner will be after Save: unchanged, a new picture (its JPEG and a preview URL), or none. */
type BannerDraft = { kind: "keep" } | { kind: "new"; jpeg: Uint8Array; url: string } | { kind: "remove" };

/**
 * Community appearance (API 0.44.0, meldiq docs/COMMUNITY_BRANDING.md): an accent colour, from Meldiq's presets or any
 * #rrggbb, and a banner, previewed together before Save. Only this community changes; Meldiq's theme and every other
 * community stay as they are. People who can't edit the community see the preview only.
 */
export function AppearanceCard({ detail, onChanged }: { detail: OrgAdminDetail; onChanged: () => void }) {
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
      const jpeg = await bannerJpeg(f);
      setBanner({ kind: "new", jpeg, url: URL.createObjectURL(new Blob([new Uint8Array(jpeg)], { type: "image/jpeg" })) });
      setSaved(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That image couldn't be used.");
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
      if (banner.kind === "new") await setCommunityBanner(engine, org.id, banner.jpeg);
      if (banner.kind === "remove") await removeCommunityBanner(engine, org.id);
      setBanner({ kind: "keep" });
      setSaved(true);
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save the appearance. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Appearance"
      sub={canEdit ? "An accent colour and a banner for this community only. Without them it uses Meldiq's colours." : "Only owners and admins can change the accent colour and banner."}
    >
      <div className={`brand-preview ${ACCENT_CLASS}`} style={accentStyle(accent)} aria-label="Preview">
        <div className="brand-preview-banner" style={bannerUrl ? { backgroundImage: `url(${bannerUrl})` } : accent ? { background: accentBand(accent) } : undefined} />
        <div className="brand-preview-body">
          <span className="brand-preview-icon">
            <OrgAvatar orgId={org.id} name={org.name} photoRev={org.photoRev} size={52} />
          </span>
          <strong className="ellipsis">{org.name}</strong>
          <span className="brand-preview-row" aria-hidden="true">
            <span className="brand-preview-channel"># general</span>
            <span className="brand-preview-btn">Join</span>
          </span>
        </div>
      </div>
      {canEdit && (
        <>
          <fieldset className="brand-swatches">
            <legend>Accent colour</legend>
            <button type="button" className="brand-swatch meldiq" aria-pressed={accent === null} onClick={() => choose(null)} title="Meldiq's colours">
              {accent === null && <Check size={14} aria-hidden="true" />}
              <span className="sr-only">Meldiq's colours</span>
            </button>
            {ACCENT_PRESETS.map((p) => (
              <button key={p.hex} type="button" className="brand-swatch" style={{ background: p.hex }} aria-pressed={accent === p.hex} onClick={() => choose(p.hex)} title={p.name}>
                {accent === p.hex && <Check size={14} aria-hidden="true" />}
                <span className="sr-only">{p.name}</span>
              </button>
            ))}
            <label className="brand-custom">
              <input type="color" value={isAccent(accent) ? accent : "#3a5bd9"} onChange={(e) => choose(e.target.value.toLowerCase())} aria-label="Pick any colour" />
              <input
                className="input mono"
                value={hex}
                maxLength={7}
                placeholder="#22d3ee"
                onChange={(e) => typed(e.target.value.trim())}
                aria-label="Accent colour as #rrggbb"
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
          <div className="brand-banner-actions">
            <input ref={file} type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files?.[0])} />
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => file.current?.click()}>
              <ImagePlus size={14} /> {bannerUrl ? "Change banner" : "Add banner"}
            </button>
            {bannerUrl && (
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setBanner({ kind: "remove" })}>
                <Trash2 size={14} /> Remove banner
              </button>
            )}
            <small className="faint">Cropped to 5:2 (1200 × 480). Members see it, and so does anyone on Discover if the community is listed.</small>
          </div>
          <ErrorLine text={error} />
          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <button type="button" className="btn btn-primary btn-sm" disabled={!dirty || !hexOk || busy} onClick={() => void save()}>
              {busy ? "Saving…" : "Save appearance"}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={!dirty || busy} onClick={cancel}>
              Cancel
            </button>
            {saved && !dirty && (
              <span className="faint" role="status">
                <Check size={14} aria-hidden="true" /> Saved
              </span>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
