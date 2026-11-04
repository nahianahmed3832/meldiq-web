import { ArrowDown, ArrowUp } from "lucide-react";
import { useEffect } from "react";
import { useEngine } from "../../application/orbit";
import { type ProfileSection } from "../../api/profileSchemas";
import { useT, type MessageKey } from "../../i18n";
import type { MyProfile } from "../../sync/profile";
import { Card, ErrorLine } from "../components/SettingsCard";
import { Toggle } from "../components/Toggle";
import { moveProfileSection, profileLayoutOf } from "../people/profileSections";
import { NO_STYLE } from "./noStyle";
import { useProfileDraft } from "./profileDraft";
import { useStyleDraft } from "./useStyleDraft";

const LABELS = { about: "files.interface.about_me_1359ec8", links: "messaging.interface.links_9024c19", connections: "workspace.side_connections" } as const satisfies Record<
  ProfileSection,
  MessageKey
>;

/** Only rendered with profile-layout support. Uses the existing revision-checked style save and unsaved guard. */
export function ProfileSectionsCard({ profile, onSaved }: { profile: MyProfile; onSaved: () => void }) {
  const engine = useEngine();
  const t = useT();
  const draft = useStyleDraft(engine, profile.profileStyle ?? NO_STYLE, () => {
    void engine.refreshAll();
    onSaved();
  });
  const layout = profileLayoutOf(draft.style);
  const update = useProfileDraft()?.update;
  useEffect(() => {
    update?.({ layout: draft.style.layout });
  }, [draft.style.layout, update]);
  return (
    <Card title={t("settings.foundation.profileSections")} sub={t("settings.foundation.profileSectionsDescription")}>
      <div className="settings-card-body">
        <ol className="profile-section-list">
          {layout.order.map((section, index) => (
            <li key={section} data-section={section}>
              <span className="grow">{t(LABELS[section])}</span>
              <Toggle
                label={t(LABELS[section])}
                checked={!layout.hidden.includes(section)}
                disabled={draft.busy}
                onChange={(show) => draft.save({ layout: { ...layout, hidden: show ? layout.hidden.filter((item) => item !== section) : [...layout.hidden, section] } })}
              />
              <button
                type="button"
                className="icon-btn"
                disabled={draft.busy || index === 0}
                aria-label={t("organization.interface.move_value0_up_4f93d15", { value0: t(LABELS[section]) })}
                onClick={() => draft.save({ layout: moveProfileSection(layout, section, -1) })}
              >
                <ArrowUp size={17} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="icon-btn"
                disabled={draft.busy || index === layout.order.length - 1}
                aria-label={t("organization.interface.move_value0_down_7c18b9e", { value0: t(LABELS[section]) })}
                onClick={() => draft.save({ layout: moveProfileSection(layout, section, 1) })}
              >
                <ArrowDown size={17} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
        <ErrorLine text={draft.error} />
        <div className="row profile-section-actions">
          <button type="button" className="btn btn-secondary" disabled={!draft.dirty || draft.busy} onClick={draft.reset}>
            {t("settings.foundation.resetSections")}
          </button>
          <button type="button" className="btn btn-primary" disabled={!draft.dirty || draft.busy} onClick={() => void draft.apply()}>
            {draft.busy ? t("common.common_saving") : t("settings.foundation.saveSections")}
          </button>
        </div>
      </div>
    </Card>
  );
}
