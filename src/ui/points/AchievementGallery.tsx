import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { interfaceLocale } from "../../i18n/format";
import { Check, LockKeyhole } from "lucide-react";
import { useState } from "react";
import type { Achievement } from "../../sync/points";
import { pinImage } from "../../sync/pins";
export function AchievementGallery({ achievements }: { achievements: Achievement[] }) {
  useLocaleRender();
  const [selected, setSelected] = useState<string | null>(null);
  const picked = achievements.find((a) => a.id === selected);
  const earned = achievements.filter((a) => a.earnedAt !== null).length;
  return (
    <section className="ember-achievements" aria-label={uiText("workspace.interface.achievement_collection_ca289a8")}>
      <div className="ember-section-heading">
        <div>
          <h2>
            <Localized k="workspace.interface.your_badge_collection_cad692f" />
          </h2>
          <p>
            <Localized k="workspace.interface.little_symbols_real_milestones_earned_badges_appear_on_your_profi_6e6ee07" />
          </p>
        </div>
        <span>
          <Localized k="workspace.interface.unlocked_d55e1ac" slots={[earned, achievements.length]} />
        </span>
      </div>
      {!achievements.length && (
        <p className="muted">
          <Localized k="workspace.interface.your_achievement_collection_will_appear_when_the_server_finishes_400268d" />
        </p>
      )}
      <div className="achievement-grid">
        {achievements.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`achievement-medal tier-${a.tier}${a.earnedAt !== null ? " earned" : " locked"}`}
            aria-pressed={selected === a.id}
            title={uiText("messaging.interface.value0_value1_75414c2", { value0: a.name, value1: a.description })}
            aria-label={uiText("messaging.interface.value0_value1_c55f6a8", {
              value0: a.name,
              value1: a.earnedAt !== null ? uiText("workspace.interface.unlocked_9bb5a73") : uiText("workspace.interface.value0_of_value1_ca6c5e5", { value0: a.progress, value1: a.goal }),
            })}
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
            <span className="ember-eyebrow">
              <Localized k="workspace.interface.achievement_d75483b" slots={[picked.tier]} />
            </span>
            <h3>{picked.name}</h3>
            <p>{picked.description}</p>
            <small>
              {picked.earnedAt !== null
                ? uiText("workspace.interface.unlocked_value0_displayed_on_your_profile_11bd0bf", { value0: new Date(picked.earnedAt).toLocaleDateString(interfaceLocale()) })
                : uiText("workspace.interface.value0_value1_progress_counts_automatically_172f788", {
                    value0: picked.progress.toLocaleString(interfaceLocale()),
                    value1: picked.goal.toLocaleString(interfaceLocale()),
                  })}
            </small>
          </div>
        </div>
      ) : (
        <p className="achievement-hint">
          <Localized k="workspace.interface.hover_or_select_a_badge_to_discover_its_story_ed381db" />
        </p>
      )}
    </section>
  );
}
