import { Gem, HardDriveUpload, Mic, MonitorUp, Smile } from "lucide-react";
import type { MojoCatalog, SparkLevel } from "../../api/mojoSchemas";
import { screenLabel, size } from "./mojoFormat";

interface SparkTrackProps {
  levels: readonly SparkLevel[];
  /** The community's level now; null on the Mojo page, where no community is in view. */
  level: number | null;
  /** Active Sparks there, for the track's fill (null: the levels alone). */
  active: number | null;
}

/** The three Spark levels as a track (server docs/MOJO.md › Meldiq Spark), filled up to the community's level. */
export function SparkTrack({ levels, level, active }: SparkTrackProps) {
  const top = levels.at(-1)?.sparks ?? 3;
  const fill = active === null ? 100 : Math.min(100, (active / top) * 100);
  return (
    <div className="spark-track" role="img" aria-label={level === null ? `Levels 1 to ${levels.length}` : `Level ${level} of ${levels.length}`}>
      <div className="spark-track-line" aria-hidden="true">
        <span style={{ width: `${fill}%` }} />
      </div>
      <ol className="spark-track-stops" aria-hidden="true">
        {levels.map((l) => (
          <li key={l.level} className={level === null || level >= l.level ? "reached" : undefined} style={{ left: `${(l.sparks / top) * 100}%` }}>
            <Gem size={22} />
            <span>Level {l.level}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

interface SparkLevelCardsProps {
  catalog: MojoCatalog;
  levels: readonly SparkLevel[];
  /** The community's level, to mark which are unlocked; null on the Mojo page. */
  level: number | null;
}

/** What each level gives everyone in a community, one card per level. */
export function SparkLevelCards({ catalog, levels, level }: SparkLevelCardsProps) {
  return (
    <div className="spark-levels">
      {levels.map((l) => {
        const unlocked = level !== null && level >= l.level;
        return (
          <article key={l.level} className={`spark-level${unlocked ? " unlocked" : ""}`} aria-label={`Level ${l.level}`}>
            <h3>
              <Gem size={18} aria-hidden="true" />
              <span className="lines">
                <span>Level {l.level}</span>
                <small>{level !== null && unlocked ? "Unlocked" : l.level === levels.length ? `${l.sparks} or more Sparks` : `${l.sparks} Spark${l.sparks === 1 ? "" : "s"}`}</small>
              </span>
            </h3>
            <ul>
              <li>
                <Smile size={15} aria-hidden="true" /> {l.emojiSlots} emoji slots
              </li>
              <li>
                <HardDriveUpload size={15} aria-hidden="true" /> {l.uploadBytes ? `${size(l.uploadBytes)} uploads for everyone` : "Everyone's own uploads"}
              </li>
              <li>
                <Mic size={15} aria-hidden="true" /> {l.voiceKbps} kbps voice
              </li>
              <li>
                <MonitorUp size={15} aria-hidden="true" /> {screenLabel(catalog, l.screen)} screen sharing for everyone
              </li>
            </ul>
          </article>
        );
      })}
    </div>
  );
}
