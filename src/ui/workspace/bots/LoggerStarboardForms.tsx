import { BOT_LIMITS } from "../../../sync/officialBotRules";
import { Toggle } from "../../components/Toggle";
import { BotField, ChannelList, ChannelSelect } from "./BotParts";
import type { BotFormProps } from "./botForm";

/** Logger: quiet until the log channel is picked. Plus: member events in their own channel, channels left out. */
export function LoggerForm({ draft, set, botsPlus, paused, channels }: BotFormProps<"logger">) {
  const picked = channels.find((c) => c.id === draft.channelId);
  return (
    <>
      <BotField label="Log channel" hint="Logger stays quiet until you pick one." botsPlus={botsPlus}>
        <ChannelSelect id="logger-channel" value={draft.channelId} channels={channels} none="Pick the log channel" onChange={(channelId) => set({ channelId })} />
        {picked && picked.kind !== "PRIVATE" && (
          <small className="obot-warn" role="note">
            #{picked.name} isn't private: everyone there can read the log. A private channel is best.
          </small>
        )}
      </BotField>
      <BotField label="Member events in their own channel" hint="Joins, leaves, kicks, bans, timeouts and role changes." plus botsPlus={botsPlus} paused={paused.includes("memberChannelId")}>
        <ChannelSelect id="logger-members" value={draft.memberChannelId} channels={channels} none="Same as the log channel" onChange={(memberChannelId) => set({ memberChannelId })} />
      </BotField>
      <BotField label="Channels left out" plus botsPlus={botsPlus} paused={paused.includes("excludeChannelIds")}>
        <ChannelList
          label="Leave a channel out of the log"
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
  return (
    <>
      <BotField label="Starboard channel" hint="Starboard stays quiet until you pick one." botsPlus={botsPlus}>
        <ChannelSelect id="starboard-channel" value={draft.channelId} channels={channels} none="Pick the starboard channel" onChange={(channelId) => set({ channelId })} />
      </BotField>
      <BotField label="Stars needed" botsPlus={botsPlus}>
        <select id="starboard-threshold" className="input" aria-label="Stars needed" value={draft.threshold} onChange={(e) => set({ threshold: Number(e.target.value) })}>
          {BOT_LIMITS.starThresholds.map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "star" : "stars"}
            </option>
          ))}
        </select>
      </BotField>
      <BotField label="Star emoji" hint="Instead of ⭐ and 🌟." plus botsPlus={botsPlus} paused={paused.includes("emoji")}>
        <input className="input" aria-label="Star emoji" placeholder="⭐" maxLength={BOT_LIMITS.emoji} value={draft.emoji ?? ""} onChange={(e) => set({ emoji: e.target.value || null })} />
      </BotField>
      <BotField label="Star your own messages" plus botsPlus={botsPlus} paused={paused.includes("selfStar")}>
        <div className="setting">
          <span className="lines">
            <small>People's stars on their own messages count too.</small>
          </span>
          <Toggle checked={draft.selfStar} onChange={(selfStar) => set({ selfStar })} label="Star your own messages" />
        </div>
      </BotField>
      <BotField label="Channels left out" plus botsPlus={botsPlus} paused={paused.includes("excludeChannelIds")}>
        <ChannelList
          label="Leave a channel out of the starboard"
          value={draft.excludeChannelIds}
          channels={channels}
          max={BOT_LIMITS.excludedChannels}
          onChange={(excludeChannelIds) => set({ excludeChannelIds })}
        />
      </BotField>
    </>
  );
}
