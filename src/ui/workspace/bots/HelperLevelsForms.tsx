import { Plus, X } from "lucide-react";
import { BOT_LIMITS, LEVEL_UP_PLACEHOLDERS } from "../../../sync/officialBotRules";
import { Toggle } from "../../components/Toggle";
import { BotField, ChannelSelect, Placeholders } from "./BotParts";
import type { BotFormProps } from "./botForm";

/** Helper: the built-in commands need nothing (the window lists them). Plus: the community's own commands. */
export function HelperForm({ draft, set, botsPlus, paused }: BotFormProps<"helper">) {
  const setCommand = (i: number, patch: Partial<{ name: string; response: string }>) => set({ commands: draft.commands.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  return (
    <BotField
      label={`Your own commands · ${draft.commands.length} of ${BOT_LIMITS.customCommands}`}
      hint="Like !rules or !socials. In the answer, {user} mentions whoever ran it."
      plus
      botsPlus={botsPlus}
      paused={paused.includes("commands")}
    >
      {draft.commands.map((c, i) => (
        <div key={i} className="obot-command">
          <span className="obot-bang" aria-hidden="true">
            !
          </span>
          <input
            className="input obot-command-name"
            aria-label={`Command ${i + 1} name`}
            placeholder="rules"
            maxLength={BOT_LIMITS.customCommandName + 1}
            value={c.name}
            onChange={(e) => setCommand(i, { name: e.target.value })}
          />
          <textarea
            className="input grow"
            rows={1}
            aria-label={`Command ${i + 1} answer`}
            placeholder="Be kind, {user}!"
            maxLength={BOT_LIMITS.customResponse}
            value={c.response}
            onChange={(e) => setCommand(i, { response: e.target.value })}
          />
          <button type="button" className="icon-btn icon-btn-xs" aria-label={`Remove command ${i + 1}`} onClick={() => set({ commands: draft.commands.filter((_, j) => j !== i) })}>
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        disabled={draft.commands.length >= BOT_LIMITS.customCommands}
        onClick={() => set({ commands: [...draft.commands, { name: "", response: "" }] })}
      >
        <Plus size={14} /> Add a command
      </button>
    </BotField>
  );
}

const BOOST_LABEL = (b: number) => `${b}×`;

/**
 * Levels: announce level-ups and where. Plus: an XP boost, roles for reaching a level (up to 20) and the level-up
 * message.
 */
export function LevelsForm({ draft, set, botsPlus, paused, channels, roles }: BotFormProps<"levels">) {
  const setReward = (i: number, patch: Partial<{ level: number; roleId: string }>) => set({ roleRewards: draft.roleRewards.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const nextLevel = Math.min(BOT_LIMITS.maxLevel, Math.max(0, ...draft.roleRewards.map((r) => r.level)) + 5);
  return (
    <>
      <div className="setting">
        <span className="lines">
          <strong>Announce level-ups</strong>
          <small>Levels cheers when someone goes up a level.</small>
        </span>
        <Toggle checked={draft.announce} onChange={(announce) => set({ announce })} label="Announce level-ups" />
      </div>
      {draft.announce && (
        <BotField label="Announce in" botsPlus={botsPlus}>
          <ChannelSelect id="levels-where" value={draft.announceChannelId} channels={channels} none="Where they're chatting" onChange={(announceChannelId) => set({ announceChannelId })} />
        </BotField>
      )}
      <BotField label="XP boost" plus botsPlus={botsPlus} paused={paused.includes("boost")}>
        <div className="segmented" role="radiogroup" aria-label="XP boost">
          {BOT_LIMITS.xpBoosts.map((b) => (
            <button key={b} type="button" role="radio" aria-checked={draft.boost === b} onClick={() => set({ boost: b })}>
              {BOOST_LABEL(b)}
            </button>
          ))}
        </div>
      </BotField>
      <BotField
        label={`Role rewards · ${draft.roleRewards.length} of ${BOT_LIMITS.roleRewards}`}
        hint="Reaching the level gives the role. Roles with admin powers can't be given by a bot."
        plus
        botsPlus={botsPlus}
        paused={paused.includes("roleRewards")}
      >
        {draft.roleRewards.map((r, i) => (
          <div key={i} className="obot-command">
            <label className="obot-inline-label" htmlFor={`reward-level-${i}`}>
              Level
            </label>
            <input
              id={`reward-level-${i}`}
              className="input obot-level"
              type="number"
              min={1}
              max={BOT_LIMITS.maxLevel}
              value={r.level}
              onChange={(e) => setReward(i, { level: Math.trunc(Number(e.target.value)) || 1 })}
            />
            <select className="input grow" aria-label={`Role for level ${r.level}`} value={r.roleId} onChange={(e) => setReward(i, { roleId: e.target.value })}>
              <option value="">Pick a role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            <button type="button" className="icon-btn icon-btn-xs" aria-label={`Remove the level ${r.level} reward`} onClick={() => set({ roleRewards: draft.roleRewards.filter((_, j) => j !== i) })}>
              <X size={14} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={draft.roleRewards.length >= BOT_LIMITS.roleRewards}
          onClick={() => set({ roleRewards: [...draft.roleRewards, { level: nextLevel, roleId: "" }] })}
        >
          <Plus size={14} /> Add a reward
        </button>
      </BotField>
      <BotField label="Level-up message" hint="{user} mentions them, {level} is their new level. Empty: Meldiq's own line." plus botsPlus={botsPlus} paused={paused.includes("levelUpMessage")}>
        <textarea
          className="input"
          rows={2}
          maxLength={BOT_LIMITS.welcomeMessage}
          aria-label="Level-up message"
          placeholder="🎉 {user} just reached level {level}!"
          value={draft.levelUpMessage ?? ""}
          onChange={(e) => set({ levelUpMessage: e.target.value || null })}
        />
        <Placeholders items={LEVEL_UP_PLACEHOLDERS} onPick={(p) => set({ levelUpMessage: `${draft.levelUpMessage ?? ""}${p}` })} />
      </BotField>
    </>
  );
}
