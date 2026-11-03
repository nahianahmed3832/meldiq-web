import { useLocaleRender } from "../../../i18n/Localized";
import { text as uiText } from "../../../i18n";
import { Localized } from "../../../i18n/Localized";
import { BOT_LIMITS } from "../../../sync/officialBotRules";
import { BotField, ChannelSelect } from "./BotParts";
import type { BotFormProps } from "./botForm";
/**
 * Giveaways: people who moderate messages run one with !giveaway (3 winners and 7 days, 20 and 30 with Bots+). Plus:
 * only members holding a role may win.
 */
export function GiveawaysForm({ draft, set, botsPlus, paused, roles }: BotFormProps<"giveaways">) {
  useLocaleRender();
  const winners = botsPlus ? BOT_LIMITS.giveawayWinners.plus : BOT_LIMITS.giveawayWinners.free;
  const days = botsPlus ? BOT_LIMITS.giveawayDays.plus : BOT_LIMITS.giveawayDays.free;
  return (
    <>
      <p className="faint">
        <Localized k="workspace.interface.here_up_to_winners_and_days_per_giveaway_bots_never_win_and_winne_e1faa7b" slots={[winners, days]} />
      </p>
      <BotField
        label={uiText("workspace.interface.who_may_win_a4b545d")}
        hint={uiText("workspace.interface.taken_when_the_giveaway_starts_11410a0")}
        plus
        botsPlus={botsPlus}
        paused={paused.includes("requiredRoleId")}
      >
        <select
          className="input"
          aria-label={uiText("workspace.interface.role_needed_to_win_c0254ec")}
          value={draft.requiredRoleId ?? ""}
          onChange={(e) => set({ requiredRoleId: e.target.value || null })}
        >
          <option value="">
            <Localized k="workspace.interface.everyone_da2e5dc" />
          </option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              <Localized k="workspace.interface.only_people_with_a645e60" slots={[r.name]} />
            </option>
          ))}
        </select>
      </BotField>
    </>
  );
}
/** Wordy: the channel where the daily word is played and the recap goes (its commands are listed by the window). */
export function WordyForm({ draft, set, botsPlus, channels }: BotFormProps<"wordy">) {
  useLocaleRender();
  return (
    <BotField
      label={uiText("workspace.interface.wordy_channel_2dfbe07")}
      hint={uiText("workspace.interface.quiet_until_you_pick_one_a_new_word_for_everyone_at_00_00_utc_wit_63bf3f3")}
      botsPlus={botsPlus}
    >
      <ChannelSelect id="wordy-channel" value={draft.channelId} channels={channels} none={uiText("organization.interface.pick_a_channel_7ed32e3")} onChange={(channelId) => set({ channelId })} />
    </BotField>
  );
}
