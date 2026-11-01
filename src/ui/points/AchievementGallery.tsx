import { Check, LockKeyhole } from "lucide-react";
import { useState } from "react";
import type { Achievement } from "../../sync/points";
import { pinImage } from "../../sync/pins";

export function AchievementGallery({ achievements }: { achievements: Achievement[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const picked = achievements.find((a) => a.id === selected);
  const earned = achievements.filter((a) => a.earnedAt !== null).length;
  return (
    <section className="ember-achievements" aria-label="Achievement collection">
      <div className="ember-section-heading">
        <div>
          <h2>Your badge collection</h2>
          <p>Little symbols. Real milestones. Earned badges appear on your profile.</p>
        </div>
        <span>
          {earned} / {achievements.length} unlocked
        </span>
      </div>
      {!achievements.length && <p className="muted">Your achievement collection will appear when the server finishes syncing.</p>}
      <div className="achievement-grid">
        {achievements.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`achievement-medal tier-${a.tier}${a.earnedAt !== null ? " earned" : " locked"}`}
            aria-pressed={selected === a.id}
            title={`${a.name} · ${a.description}`}
            aria-label={`${a.name}, ${a.earnedAt !== null ? "unlocked" : `${a.progress} of ${a.goal}`}`}
            onClick={() => setSelected((id) => (id === a.id ? null : a.id))}
          >
            <img src={pinImage(a.id)} width={64} height={64} alt="" loading="lazy" decoding="async" />
            {a.earnedAt !== null ? <Check size={12} className="achievement-state" aria-hidden="true" /> : <LockKeyhole size={11} className="achievement-state" aria-hidden="true" />}
            <span className="achievement-mini-progress" aria-hidden="true">
              <i style={{ width: `${Math.min(100, (a.progress / a.goal) * 100)}%` }} />
            </span>
          </button>
        ))}
      </div>
      {picked ? (
        <div className={`achievement-details tier-${picked.tier}`} role="status">
          <img src={pinImage(picked.id)} width={56} height={56} alt="" />
          <div>
            <span className="ember-eyebrow">{picked.tier} achievement</span>
            <h3>{picked.name}</h3>
            <p>{picked.description}</p>
            <small>
              {picked.earnedAt !== null
                ? `Unlocked ${new Date(picked.earnedAt).toLocaleDateString()}. Displayed on your profile.`
                : `${picked.progress.toLocaleString()} / ${picked.goal.toLocaleString()} · Progress counts automatically.`}
            </small>
          </div>
        </div>
      ) : (
        <p className="achievement-hint">Hover or select a badge to discover its story.</p>
      )}
    </section>
  );
}
