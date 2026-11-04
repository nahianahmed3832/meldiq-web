import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { useEffect, useState } from "react";
import type { Conversation } from "../../api/schemas";
import { useEngine } from "../../application/orbit";
import { communitySettings, saveCommunitySettings } from "../../sync/communitySettings";
import { Toggle } from "../components/Toggle";
import { useAction, useLoad } from "./useLoad";
import { Card, ErrorLine } from "../components/SettingsCard";
interface OnboardingGateCardProps {
  orgId: string;
  /** The community's channels, for the starting channel (public text and announcement channels only). */
  channels: Conversation[];
}
/**
 * Onboarding › Must finish before chatting and Starting channel (community parity A3): new members read but can't post
 * until they finish, then land in the starting channel. Members can redo it from the community menu.
 */
export function OnboardingGateCard({ orgId, channels }: OnboardingGateCardProps) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const settings = useLoad(() => communitySettings(engine, orgId), [engine, orgId]);
  const [required, setRequired] = useState(false);
  const [start, setStart] = useState<string | null>(null);
  const save = useAction();
  useEffect(() => {
    if (!settings.data) return;
    setRequired(settings.data.onboardingRequired);
    setStart(settings.data.startChannelId);
  }, [settings.data]);
  const places = channels.filter((c) => !c.voice && c.format !== "forum" && (c.kind === "PUBLIC" || c.kind === "ANNOUNCEMENT") && !c.archived);
  const dirty = !!settings.data && (required !== settings.data.onboardingRequired || start !== settings.data.startChannelId);
  return (
    <Card title={uiText("workspace.interface.after_the_questions_ec1e563")} sub={uiText("workspace.interface.only_people_who_join_from_now_on_are_held_back_everyone_can_redo_96752fe")}>
      <ErrorLine text={settings.error ?? save.error} />
      <div className="setting">
        <span className="lines">
          <strong>
            <Localized k="workspace.interface.must_finish_before_chatting_3fbab26" />
          </strong>
          <small>
            <Localized k="workspace.interface.new_members_can_read_everything_but_can_t_post_or_react_until_the_f6e6826" />
          </small>
        </span>
        <Toggle checked={required} onChange={setRequired} label={uiText("workspace.interface.must_finish_before_chatting_3fbab26")} disabled={!settings.data} />
      </div>
      <label className="field">
        <span>
          <Localized k="workspace.interface.starting_channel_1d88a39" />
        </span>
        <select className="input" value={start ?? ""} onChange={(e) => setStart(e.target.value || null)} disabled={!settings.data}>
          <option value="">
            <Localized k="workspace.interface.same_as_usual_a2f8c81" />
          </option>
          {places.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.name}
            </option>
          ))}
        </select>
        <small className="faint">
          <Localized k="workspace.interface.where_people_land_once_they_finish_it_has_to_be_a_channel_everyon_f0de107" />
        </small>
      </label>
      <div>
        <button
          className="btn btn-primary btn-sm"
          disabled={!dirty || save.busy}
          onClick={() => void save.act(() => saveCommunitySettings(engine, orgId, { onboardingRequired: required, startChannelId: start }).then(settings.reload))}
        >
          {save.busy ? l10n("common.common_saving") : l10n("common.actions.save")}
        </button>
      </div>
    </Card>
  );
}
