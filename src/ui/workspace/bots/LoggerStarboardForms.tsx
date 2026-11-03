import { countLabel } from "../../../i18n/counts";
import { useLocaleRender } from "../../../i18n/Localized";
import { text as uiText } from "../../../i18n";
import { Localized } from "../../../i18n/Localized";
import { BOT_LIMITS } from "../../../sync/officialBotRules";
import { Toggle } from "../../components/Toggle";
import { BotField, ChannelList, ChannelSelect } from "./BotParts";
import type { BotFormProps } from "./botForm";
/** Logger: quiet until the log channel is picked. Plus: member events in their own channel, channels left out. */
export function LoggerForm({ draft, set, botsPlus, paused, channels }: BotFormProps<"logger">) {
  useLocaleRender();
  const picked = channels.find((c) => c.id === draft.channelId);
  return (
    <>
      <BotField label={uiText("organization.interface.log_channel_1c1b4e9")} hint={uiText("workspace.interface.logger_stays_quiet_until_you_pick_one_06878d9")} botsPlus={botsPlus}>
        <ChannelSelect
          id="logger-channel"
          value={draft.channelId}
          channels={channels}
          none={uiText("organization.interface.pick_the_log_channel_3f91c8b")}
          onChange={(channelId) => set({ channelId })}
        />
        {picked && picked.kind !== "PRIVATE" && (
          <small className="obot-warn" role="note">
            <Localized k="workspace.interface.isn_t_private_everyone_there_can_read_the_log_a_private_channel_i_09d4a91" slots={[picked.name]} />
          </small>
        )}
      </BotField>
      <BotField
        label={uiText("workspace.interface.member_events_in_their_own_channel_4145b47")}
        hint={uiText("workspace.interface.joins_leaves_kicks_bans_timeouts_and_role_changes_1f8ff38")}
        plus
        botsPlus={botsPlus}
        paused={paused.includes("memberChannelId")}
      >
        <ChannelSelect
          id="logger-members"
          value={draft.memberChannelId}
          channels={channels}
          none={uiText("organization.interface.same_as_the_log_channel_aa58cb7")}
          onChange={(memberChannelId) => set({ memberChannelId })}
        />
      </BotField>
      <BotField label={uiText("workspace.interface.channels_left_out_d129c82")} plus botsPlus={botsPlus} paused={paused.includes("excludeChannelIds")}>
        <ChannelList
          label={uiText("workspace.interface.leave_a_channel_out_of_the_log_6e416d1")}
          value={draft.excludeChannelIds}
          channels={channels}
          max={BOT_LIMITS.excludedChannels}
          onChange={(excludeChannelIds) => set({ excludeChannelIds })}
        />
      </BotField>
    </>
  );
}
/** Starboard: its channel and how many stars a message needs. Plus: the emoji, self-stars, channels left out. */
export function StarboardForm({ draft, set, botsPlus, paused, channels }: BotFormProps<"starboard">) {
  useLocaleRender();
  return (
    <>
      <BotField label={uiText("workspace.interface.starboard_channel_c5ca090")} hint={uiText("workspace.interface.starboard_stays_quiet_until_you_pick_one_d0a4015")} botsPlus={botsPlus}>
        <ChannelSelect
          id="starboard-channel"
          value={draft.channelId}
          channels={channels}
          none={uiText("organization.interface.pick_the_starboard_channel_3f847c0")}
          onChange={(channelId) => set({ channelId })}
        />
      </BotField>
      <BotField label={uiText("workspace.interface.stars_needed_375e783")} botsPlus={botsPlus}>
        <select
          id="starboard-threshold"
          className="input"
          aria-label={uiText("workspace.interface.stars_needed_375e783")}
          value={draft.threshold}
          onChange={(e) => set({ threshold: Number(e.target.value) })}
        >
          {BOT_LIMITS.starThresholds.map((n) => (
            <option key={n} value={n}>
              {countLabel(n, "stars")}
            </option>
          ))}
        </select>
      </BotField>
      <BotField label={uiText("workspace.interface.star_emoji_ae37abb")} hint={uiText("workspace.interface.instead_of_and_113169b")} plus botsPlus={botsPlus} paused={paused.includes("emoji")}>
        <input
          className="input"
          aria-label={uiText("workspace.interface.star_emoji_ae37abb")}
          placeholder="⭐"
          maxLength={BOT_LIMITS.emoji}
          value={draft.emoji ?? ""}
          onChange={(e) => set({ emoji: e.target.value || null })}
        />
      </BotField>
      <BotField label={uiText("workspace.interface.star_your_own_messages_2c8ca94")} plus botsPlus={botsPlus} paused={paused.includes("selfStar")}>
        <div className="setting">
          <span className="lines">
            <small>
              <Localized k="workspace.interface.people_s_stars_on_their_own_messages_count_too_509a461" />
            </small>
          </span>
          <Toggle checked={draft.selfStar} onChange={(selfStar) => set({ selfStar })} label={uiText("workspace.interface.star_your_own_messages_2c8ca94")} />
        </div>
      </BotField>
      <BotField label={uiText("workspace.interface.channels_left_out_d129c82")} plus botsPlus={botsPlus} paused={paused.includes("excludeChannelIds")}>
        <ChannelList
          label={uiText("workspace.interface.leave_a_channel_out_of_the_starboard_efcd4a8")}
          value={draft.excludeChannelIds}
          channels={channels}
          max={BOT_LIMITS.excludedChannels}
          onChange={(excludeChannelIds) => set({ excludeChannelIds })}
        />
      </BotField>
    </>
  );
}
