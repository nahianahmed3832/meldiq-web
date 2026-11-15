import { useEngine, useOrbit } from "../../application/orbit";
import { setPrefs, usePrefs } from "../../application/prefs";
import { videoModeOf, videoTier, videoTierLabel } from "../../call/shareQuality";
import { useT } from "../../i18n";

export function CallQualitySelect({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const engine = useEngine();
  const prefs = usePrefs();
  const call = useOrbit((s) => s.call);
  const plan = useOrbit((s) => s.mojo.me?.plan);
  const active = call.phase !== "idle" && call.phase !== "ended";
  const tier = active ? call.videoTier : videoTier(plan);
  const label = t("calls.videoQuality.label");

  return (
    <label className={compact ? "call-quality compact" : "call-quality"}>
      {!compact && (
        <span className="lines">
          <strong>{label}</strong>
          <small>{t("calls.videoQuality.description")}</small>
        </span>
      )}
      <select
        className="input"
        aria-label={label}
        value={active ? call.videoQuality : prefs.videoQuality}
        onChange={(e) => {
          const videoQuality = videoModeOf(e.target.value);
          setPrefs({ videoQuality });
          void engine.calls.setVideoQuality(videoQuality);
        }}
      >
        <option value="auto">{t("calls.videoQuality.auto")}</option>
        <option value="plan">{videoTierLabel(tier)}</option>
      </select>
    </label>
  );
}
