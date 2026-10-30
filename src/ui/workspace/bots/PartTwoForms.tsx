import { BOT_LIMITS } from "../../../sync/officialBotRules";
import { BotField, ChannelSelect } from "./BotParts";
import type { BotFormProps } from "./botForm";

/**
 * Giveaways: people who moderate messages run one with !giveaway (3 winners and 7 days, 20 and 30 with Bots+). Plus:
 * only members holding a role may win.
 */
export function GiveawaysForm({ draft, set, botsPlus, paused, roles }: BotFormProps<"giveaways">) {
  const winners = botsPlus ? BOT_LIMITS.giveawayWinners.plus : BOT_LIMITS.giveawayWinners.free;
  const days = botsPlus ? BOT_LIMITS.giveawayDays.plus : BOT_LIMITS.giveawayDays.free;
  return (
    <>
      <p className="faint">
        Here: up to {winners} winners and {days} days per giveaway. Bots never win, and winners must still be here.
      </p>
      <BotField label="Who may win" hint="Taken when the giveaway starts." plus botsPlus={botsPlus} paused={paused.includes("requiredRoleId")}>
        <select className="input" aria-label="Role needed to win" value={draft.requiredRoleId ?? ""} onChange={(e) => set({ requiredRoleId: e.target.value || null })}>
          <option value="">Everyone</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              Only people with {r.name}
            </option>
          ))}
        </select>
      </BotField>
    </>
  );
}

/** Wordy: the channel where the daily word is played and the recap goes (its commands are listed by the window). */
export function WordyForm({ draft, set, botsPlus, channels }: BotFormProps<"wordy">) {
  return (
    <BotField label="Wordy channel" hint="Quiet until you pick one. A new word for everyone at 00:00 UTC, with a recap of the day before." botsPlus={botsPlus}>
      <ChannelSelect id="wordy-channel" value={draft.channelId} channels={channels} none="Pick a channel" onChange={(channelId) => set({ channelId })} />
    </BotField>
  );
}
