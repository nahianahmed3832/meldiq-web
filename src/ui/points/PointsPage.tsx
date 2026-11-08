import { formatUiNumber } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { interfaceLocale } from "../../i18n/format";
import { useT as useLocalization } from "../../i18n";
import { Award, Flame, History, Map } from "lucide-react";
import { useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { points as loadPoints } from "../../sync/points";
import { EmberIcon } from "../components/EmberIcon";
import { LevelRing } from "../people/LevelRing";
import { useLoad } from "../workspace/useLoad";
import { AchievementGallery } from "./AchievementGallery";
import { PointsEarn } from "./PointsEarn";
import { PointsQuests } from "./PointsQuests";
import { levelProgress } from "./pointsWords";
/** The internal points API stays compatible; the earned currency people see is Embers. */
export function PointsPage() {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const offered = useOrbit((s) => s.server?.features.includes("points") ?? false);
  const profilesRev = useOrbit((s) => s.profilesRev);
  const data = useLoad(() => (offered ? loadPoints(engine) : Promise.resolve(null)), [engine, offered, profilesRev]);
  const [tab, setTab] = useState<"quests" | "achievements" | "activity">("quests");
  const p = data.data;
  return (
    <div className="points embers-page">
      <header className="embers-heading">
        <span className="embers-brand">
          <EmberIcon size={42} />
        </span>
        <div>
          <span className="ember-eyebrow">
            <Localized k="workspace.interface.your_meldiq_journey_33ea9c4" />
          </span>
          <h1>{l10n("settings.settings_points")}</h1>
          <p>
            <Localized k="workspace.interface.show_up_find_your_people_keep_the_glow_going_13e3889" />
          </p>
        </div>
      </header>
      {!offered && (
        <p className="muted">
          <Localized k="workspace.interface.embers_aren_t_available_on_this_server_yet_788c15a" />
        </p>
      )}
      {data.error && (
        <div className="banner danger" role="alert">
          {data.error}
          <button className="btn btn-secondary btn-sm" onClick={data.reload}>
            {l10n("common.actions.retry")}
          </button>
        </div>
      )}
      {offered && !p && !data.error && <div className="skeleton" style={{ height: 180 }} aria-busy="true" />}
      {p && (
        <>
          {!p.earning && (
            <div className="banner" role="status">
              <Localized k="workspace.interface.your_campfire_is_just_getting_started_earning_opens_after_your_ac_edf33c8" />
            </div>
          )}
          <div className="embers-overview">
            <section className="embers-wallet" aria-label={uiText("workspace.interface.embers_balance_422cc4f")}>
              <div>
                <span className="ember-eyebrow">
                  <Localized k="workspace.interface.your_embers_44f81c3" />
                </span>
                <strong>{p.balance.toLocaleString(interfaceLocale())}</strong>
                <p>
                  <Localized k="workspace.interface.a_little_warmth_earned_together_e317d8d" />
                </p>
              </div>
              <EmberIcon size={82} />
              <div className="embers-wallet-stats">
                <span>
                  <Localized k="workspace.interface.today_8e5f82e" slots={[<b>+{p.earnedToday.toLocaleString(interfaceLocale())}</b>]} />
                </span>
                <span>
                  <Localized k="workspace.interface.lifetime_181b16e" slots={[<b>{p.earnedTotal.toLocaleString(interfaceLocale())}</b>]} />
                </span>
                <span>
                  <Localized k="workspace.interface.day_streak_21cdbc0" slots={[<Flame size={13} />, <b>{formatUiNumber(p.streak)}</b>]} />
                </span>
              </div>
            </section>
            <section className="embers-level" aria-label={uiText("workspace.interface.account_level_b409135")}>
              <LevelRing level={p.level} size={68} progress={levelProgress(p.balance, p.nextLevelCost)} />
              <div aria-live="polite">
                <span className="ember-eyebrow">
                  <Localized k="workspace.interface.your_next_chapter_ce35f25" />
                </span>
                <h2>
                  <Localized k="billing.interface.level_2cf0efd" slots={[p.level]} />
                </h2>
                <p>
                  <Localized k="workspace.interface.embers_to_level_63c415b" slots={[Math.max(0, p.nextLevelCost - p.balance).toLocaleString(interfaceLocale()), p.level + 1]} />
                </p>
                <p><Localized k="workspace.interface.automatic_account_level_hint" /></p>
              </div>
            </section>
          </div>
          <div className="embers-tabs" role="tablist" aria-label={uiText("workspace.interface.embers_sections_4c93070")}>
            {(
              [
                {
                  key: "quests",
                  get label() {
                    return uiText("workspace.interface.quests_60d40d9");
                  },
                  icon: Map,
                },
                {
                  key: "achievements",
                  get label() {
                    return uiText("workspace.interface.achievements_74cf2bc");
                  },
                  icon: Award,
                },
                { key: "activity", label: l10n("workspace.activity"), icon: History },
              ] as const
            ).map(({ key, label, icon: Icon }) => (
              <button key={key} role="tab" id={`ember-tab-${key}`} aria-selected={tab === key} aria-controls={`ember-panel-${key}`} onClick={() => setTab(key)}>
                <Icon size={16} />
                {label}
                {key === "achievements" && <span>{formatUiNumber(p.achievements.filter((a) => a.earnedAt !== null).length)}</span>}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`ember-panel-${tab}`} aria-labelledby={`ember-tab-${tab}`} className="embers-content">
            {tab === "quests" && (
              <>
                <PointsQuests quests={p.quests} resetsAt={p.resetsAt} />
                <PointsEarn points={p} mode="ways" />
              </>
            )}
            {tab === "achievements" && <AchievementGallery achievements={p.achievements} />}
            {tab === "activity" && <PointsEarn points={p} mode="history" />}
          </div>
          <p className="embers-footnote">
            <Localized k="workspace.interface.embers_are_earned_through_participation_they_can_t_be_bought_sold_9424d06" />
          </p>
        </>
      )}
    </div>
  );
}
