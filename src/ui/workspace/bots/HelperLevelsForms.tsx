import { useLocaleRender } from "../../../i18n/Localized";
import { text as uiText } from "../../../i18n";
import { Localized } from "../../../i18n/Localized";
import { Plus, X } from "lucide-react";
import { BOT_LIMITS, LEVEL_UP_PLACEHOLDERS } from "../../../sync/officialBotRules";
import { Toggle } from "../../components/Toggle";
import { BotField, ChannelSelect, Placeholders } from "./BotParts";
import type { BotFormProps } from "./botForm";
/** Helper: the built-in commands need nothing (the window lists them). Plus: the community's own commands. */
export function HelperForm({ draft, set, botsPlus, paused }: BotFormProps<"helper">) {
  useLocaleRender();
  const setCommand = (
    i: number,
    patch: Partial<{
      name: string;
      response: string;
    }>,
  ) => set({ commands: draft.commands.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  return (
    <BotField
      label={uiText("workspace.interface.your_own_commands_value0_of_value1_dfd2197", { value0: draft.commands.length, value1: BOT_LIMITS.customCommands })}
      hint={uiText("workspace.interface.like_rules_or_socials_in_the_answer_user_mentions_whoever_ran_it_61a8616")}
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
            aria-label={uiText("workspace.interface.command_value0_name_368eefa", { value0: i + 1 })}
            placeholder={uiText("workspace.interface.rules_6c621d1")}
            maxLength={BOT_LIMITS.customCommandName + 1}
            value={c.name}
            onChange={(e) => setCommand(i, { name: e.target.value })}
          />
          <textarea
            className="input grow"
            rows={1}
            aria-label={uiText("workspace.interface.command_value0_answer_c263288", { value0: i + 1 })}
            placeholder={uiText("workspace.interface.be_kind_user_daac0b4")}
            maxLength={BOT_LIMITS.customResponse}
            value={c.response}
            onChange={(e) => setCommand(i, { response: e.target.value })}
          />
          <button
            type="button"
            className="icon-btn icon-btn-xs"
            aria-label={uiText("workspace.interface.remove_command_value0_c9e7f00", { value0: i + 1 })}
            onClick={() => set({ commands: draft.commands.filter((_, j) => j !== i) })}
          >
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
        <Localized k="workspace.interface.add_a_command_e1adb0d" slots={[<Plus size={14} />]} />
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
  useLocaleRender();
  const setReward = (
    i: number,
    patch: Partial<{
      level: number;
      roleId: string;
    }>,
  ) => set({ roleRewards: draft.roleRewards.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const nextLevel = Math.min(BOT_LIMITS.maxLevel, Math.max(0, ...draft.roleRewards.map((r) => r.level)) + 5);
  return (
    <>
      <div className="setting">
        <span className="lines">
          <strong>
            <Localized k="workspace.interface.announce_level_ups_9c2cc95" />
          </strong>
          <small>
            <Localized k="workspace.interface.levels_cheers_when_someone_goes_up_a_level_3bb6c2b" />
          </small>
        </span>
        <Toggle checked={draft.announce} onChange={(announce) => set({ announce })} label={uiText("workspace.interface.announce_level_ups_9c2cc95")} />
      </div>
      {draft.announce && (
        <BotField label={uiText("workspace.interface.announce_in_8958bd1")} botsPlus={botsPlus}>
          <ChannelSelect
            id="levels-where"
            value={draft.announceChannelId}
            channels={channels}
            none={uiText("organization.interface.where_they_re_chatting_f29d380")}
            onChange={(announceChannelId) => set({ announceChannelId })}
          />
        </BotField>
      )}
      <BotField label={uiText("workspace.interface.xp_boost_59e1891")} plus botsPlus={botsPlus} paused={paused.includes("boost")}>
        <div className="segmented" role="radiogroup" aria-label={uiText("workspace.interface.xp_boost_59e1891")}>
          {BOT_LIMITS.xpBoosts.map((b) => (
            <button key={b} type="button" role="radio" aria-checked={draft.boost === b} onClick={() => set({ boost: b })}>
              {BOOST_LABEL(b)}
            </button>
          ))}
        </div>
      </BotField>
      <BotField
        label={uiText("workspace.interface.role_rewards_value0_of_value1_2e21ffc", { value0: draft.roleRewards.length, value1: BOT_LIMITS.roleRewards })}
        hint={uiText("workspace.interface.reaching_the_level_gives_the_role_roles_with_admin_powers_can_t_b_a20ddc9")}
        plus
        botsPlus={botsPlus}
        paused={paused.includes("roleRewards")}
      >
        {draft.roleRewards.map((r, i) => (
          <div key={i} className="obot-command">
            <label className="obot-inline-label" htmlFor={`reward-level-${i}`}>
              <Localized k="workspace.interface.level_1709305" />
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
            <select
              className="input grow"
              aria-label={uiText("workspace.interface.role_for_level_value0_3376ab0", { value0: r.level })}
              value={r.roleId}
              onChange={(e) => setReward(i, { roleId: e.target.value })}
            >
              <option value="">
                <Localized k="organization.interface.pick_a_role_575cd55" />
              </option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="icon-btn icon-btn-xs"
              aria-label={uiText("workspace.interface.remove_the_level_value0_reward_8978cff", { value0: r.level })}
              onClick={() => set({ roleRewards: draft.roleRewards.filter((_, j) => j !== i) })}
            >
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
          <Localized k="workspace.interface.add_a_reward_9f9af25" slots={[<Plus size={14} />]} />
        </button>
      </BotField>
      <BotField
        label={uiText("workspace.interface.level_up_message_eaea4db")}
        hint={uiText("workspace.interface.user_mentions_them_level_is_their_new_level_empty_meldiq_s_own_li_c808ae6")}
        plus
        botsPlus={botsPlus}
        paused={paused.includes("levelUpMessage")}
      >
        <textarea
          className="input"
          rows={2}
          maxLength={BOT_LIMITS.welcomeMessage}
          aria-label={uiText("workspace.interface.level_up_message_eaea4db")}
          placeholder={uiText("workspace.interface.user_just_reached_level_level_f6138cf")}
          value={draft.levelUpMessage ?? ""}
          onChange={(e) => set({ levelUpMessage: e.target.value || null })}
        />
        <Placeholders items={LEVEL_UP_PLACEHOLDERS} onPick={(p) => set({ levelUpMessage: `${draft.levelUpMessage ?? ""}${p}` })} />
      </BotField>
    </>
  );
}
