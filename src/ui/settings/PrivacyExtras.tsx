import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { UNKNOWN } from "../../api/enums";
import { useOrbit } from "../../application/orbit";
import { GROUP_ADD_LABEL, GROUP_ADD_POLICIES, type GroupAddPolicy, type MessagingChange, type MessagingSettings } from "../../sync/social";
import { Toggle } from "../components/Toggle";
import { LeaveManyDialog } from "./LeaveManyDialog";
const GROUP_ADD_HINT: Record<GroupAddPolicy, string> = {
  get everyone() {
    return uiText("settings.interface.anyone_who_can_find_you_can_put_you_in_a_group_chat_6495064");
  },
  get friends() {
    return uiText("settings.interface.only_your_friends_can_put_you_in_a_group_chat_e2a4433");
  },
  get nobody() {
    return uiText("settings.interface.no_one_can_put_you_in_a_group_chat_not_even_friends_you_can_still_818f09c");
  },
};
interface GroupAndSuggestRowsProps {
  settings: MessagingSettings | null;
  groupAdd: boolean;
  suggest: boolean;
  busy: boolean;
  onChange: (change: MessagingChange) => void;
}
/**
 * Settings › Privacy, API 0.65.0: who may add you to group chats (the server checks it when a group is made and when
 * someone is added), and whether you're suggested to people who share a community with you.
 */
export function GroupAndSuggestRows({ settings, groupAdd, suggest, busy, onChange }: GroupAndSuggestRowsProps) {
  useLocaleRender();
  const policy = settings?.groupAddPolicy;
  return (
    <>
      {groupAdd && (
        <div className="ws-row">
          <span className="lines grow">
            <span>
              <Localized k="settings.interface.who_can_add_you_to_group_chats_11b4ba4" />
            </span>
            <small>{policy && policy !== UNKNOWN ? GROUP_ADD_HINT[policy] : uiText("settings.interface.groups_you_make_yourself_are_never_affected_ad22b4a")}</small>
          </span>
          <select
            className="input input-sm"
            aria-label={uiText("settings.interface.who_can_add_you_to_group_chats_11b4ba4")}
            disabled={!settings || busy}
            value={policy ?? "friends"}
            onChange={(e) => onChange({ groupAddPolicy: e.target.value as GroupAddPolicy })}
          >
            {policy === UNKNOWN && (
              <option value={UNKNOWN} disabled>
                <Localized k="settings.interface.set_in_a_newer_version_of_meldiq_57dfd6c" />
              </option>
            )}
            {GROUP_ADD_POLICIES.map((p) => (
              <option key={p} value={p}>
                {GROUP_ADD_LABEL[p]}
              </option>
            ))}
          </select>
        </div>
      )}
      {suggest && (
        <div className="ws-row">
          <span className="lines grow">
            <span>
              <Localized k="settings.interface.suggest_me_to_people_who_share_communities_with_me_367d900" />
            </span>
            <small>
              <Localized k="settings.interface.you_show_up_in_their_suggested_list_under_friends_friends_people_d7bc8ef" />
            </small>
          </span>
          <Toggle
            label={uiText("settings.interface.suggest_me_to_people_who_share_communities_with_me_367d900")}
            checked={settings?.suggestable ?? false}
            disabled={!settings || busy}
            onChange={(v) => onChange({ suggestable: v })}
          />
        </div>
      )}
    </>
  );
}
/** Settings › Privacy, API 0.65.0: leave several communities in one go (the ones you own stay). */
export function LeaveManyCard() {
  useLocaleRender();
  const offered = useOrbit((s) => s.server?.features.includes("leave-many") ?? false);
  const count = useOrbit((s) => s.orgs.length);
  const [open, setOpen] = useState(false);
  if (!offered) return null;
  return (
    <div className="card">
      <div className="setting">
        <div className="lines">
          <strong>
            <Localized k="settings.interface.leave_several_communities_at_once_c986397" />
          </strong>
          <small>
            <Localized k="settings.interface.pick_the_ones_to_leave_communities_you_own_stay_hand_them_over_fi_5353c6d" />
          </small>
        </div>
        <button className="btn btn-secondary btn-sm" disabled={count === 0} onClick={() => setOpen(true)}>
          <Localized k="settings.interface.choose_c70a668" slots={[<LogOut size={14} aria-hidden="true" />]} />
        </button>
      </div>
      {open && <LeaveManyDialog onClose={() => setOpen(false)} />}
    </div>
  );
}
