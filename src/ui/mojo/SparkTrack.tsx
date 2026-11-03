import { countLabel } from "../../i18n/counts";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { Gem, HardDriveUpload, Mic, MonitorUp, Smile } from "lucide-react";
import type { MojoCatalog, SparkLevel } from "../../api/mojoSchemas";
import { screenLabel, size } from "./mojoFormat";
interface SparkTrackProps {
  levels: readonly SparkLevel[];
  /** The community's level now; null on the Meldiq Plus page, where no community is in view. */
  level: number | null;
  /** Active Sparks there, for the track's fill (null: the levels alone). */
  active: number | null;
}
/** The three Spark levels as a track (server docs/MOJO.md › Meldiq Spark), filled up to the community's level. */
export function SparkTrack({ levels, level, active }: SparkTrackProps) {
  useLocaleRender();
  const top = levels.at(-1)?.sparks ?? 3;
  const fill = active === null ? 100 : Math.min(100, (active / top) * 100);
  return (
    <div
      className="spark-track"
      role="img"
      aria-label={
        level === null
          ? uiText("billing.interface.levels_1_to_value0_d8d049d", { value0: levels.length })
          : uiText("billing.interface.level_value0_of_value1_855ff9d", { value0: level, value1: levels.length })
      }
    >
      <div className="spark-track-line" aria-hidden="true">
        <span style={{ width: `${fill}%` }} />
      </div>
      <ol className="spark-track-stops" aria-hidden="true">
        {levels.map((l) => (
          <li key={l.level} className={level === null || level >= l.level ? "reached" : undefined} style={{ insetInlineStart: `${(l.sparks / top) * 100}%` }}>
            <Gem size={22} />
            <span>
              <Localized k="billing.interface.level_2cf0efd" slots={[l.level]} />
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
interface SparkLevelCardsProps {
  catalog: MojoCatalog;
  levels: readonly SparkLevel[];
  /** The community's level, to mark which are unlocked; null on the Meldiq Plus page. */
  level: number | null;
}
/** What each level gives everyone in a community, one card per level. */
export function SparkLevelCards({ catalog, levels, level }: SparkLevelCardsProps) {
  useLocaleRender();
  return (
    <div className="spark-levels">
      {levels.map((l) => {
        const unlocked = level !== null && level >= l.level;
        return (
          <article key={l.level} className={`spark-level${unlocked ? " unlocked" : ""}`} aria-label={uiText("billing.interface.level_value0_6095a3d", { value0: l.level })}>
            <h3>
              <Gem size={18} aria-hidden="true" />
              <span className="lines">
                <span>
                  <Localized k="billing.interface.level_2cf0efd" slots={[l.level]} />
                </span>
                <small>
                  {level !== null && unlocked
                    ? uiText("billing.interface.unlocked_531c7b2")
                    : l.level === levels.length
                      ? uiText("billing.interface.value0_or_more_sparks_f922cf2", { value0: l.sparks })
                      : countLabel(l.sparks, "sparks")}
                </small>
              </span>
            </h3>
            <ul>
              <li>
                <Localized k="billing.interface.emoji_slots_bd40a59" slots={[<Smile size={15} aria-hidden="true" />, l.emojiSlots]} />
              </li>
              <li>
                <HardDriveUpload size={15} aria-hidden="true" />{" "}
                {l.uploadBytes ? uiText("billing.interface.value0_uploads_for_everyone_87f3948", { value0: size(l.uploadBytes) }) : uiText("billing.interface.everyone_s_own_uploads_3fe0db0")}
              </li>
              <li>
                <Localized k="billing.interface.kbps_voice_85c6c0b" slots={[<Mic size={15} aria-hidden="true" />, l.voiceKbps]} />
              </li>
              <li>
                <Localized k="billing.interface.screen_sharing_for_everyone_026fe47" slots={[<MonitorUp size={15} aria-hidden="true" />, screenLabel(catalog, l.screen)]} />
              </li>
            </ul>
          </article>
        );
      })}
    </div>
  );
}
