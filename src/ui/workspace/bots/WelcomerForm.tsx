import { useLocaleRender } from "../../../i18n/Localized";
import { text as uiText } from "../../../i18n";
import { Localized } from "../../../i18n/Localized";
import { useT as useLocalization } from "../../../i18n";
import { Plus, Send, X } from "lucide-react";
import { useState } from "react";
import { useEngine, useOrbit } from "../../../application/orbit";
import { BOT_LIMITS, fillWelcome, WELCOME_PLACEHOLDERS } from "../../../sync/officialBotRules";
import { officialBotError, testWelcomer } from "../../../sync/officialBots";
import { BotField, ChannelSelect, Placeholders, PlusChip } from "./BotParts";
import type { BotFormProps } from "./botForm";
/**
 * Welcomer: the welcome channel (automatic picks #general), the greeting with its placeholders and a live preview, and
 * "Send a test". Plus: up to 10 greetings (one picked at random) and a goodbye.
 */
export function WelcomerForm({ draft, set, botsPlus, paused, channels, ctx }: BotFormProps<"welcomer">) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const me = useOrbit((s) => s.me);
  const [test, setTest] = useState<{
    busy: boolean;
    note: string | null;
  }>({ busy: false, note: null });
  const max = botsPlus ? BOT_LIMITS.welcomeLines.plus : BOT_LIMITS.welcomeLines.free;
  const setLine = (i: number, text: string) => set({ messages: draft.messages.map((m, j) => (j === i ? text : m)) });
  const preview = fillWelcome(draft.messages[0] ?? "", { user: me?.username ?? "you", name: me?.displayName ?? uiText("workspace.nav_you"), server: ctx.orgName, count: ctx.memberCount });
  const sendTest = async () => {
    setTest({ busy: true, note: null });
    try {
      const sent = await testWelcomer(engine, ctx.orgId);
      const where = channels.find((c) => c.id === sent.channelId)?.name;
      setTest({ busy: false, note: uiText("workspace.interface.sent_value0_have_a_look_efc90e4", { value0: where ? uiText("organization.interface.to_159683c", { value0: where }) : "" }) });
    } catch (e) {
      setTest({ busy: false, note: officialBotError(e) });
    }
  };
  return (
    <>
      <BotField label={uiText("workspace.interface.welcome_channel_a43b9ef")} botsPlus={botsPlus}>
        <ChannelSelect
          id="welcomer-channel"
          value={draft.channelId}
          channels={channels}
          none={uiText("organization.interface.automatic_general_d750fba")}
          onChange={(channelId) => set({ channelId })}
        />
      </BotField>
      <BotField
        label={draft.messages.length > 1 ? uiText("workspace.interface.greetings_one_picked_at_random_35174bf") : uiText("workspace.interface.greeting_2f35055")}
        hint={uiText("workspace.interface.up_to_value0_characters_user_mentions_them_name_is_their_name_ser_1c5e402", { value0: BOT_LIMITS.welcomeMessage })}
        botsPlus={botsPlus}
        paused={paused.includes("messages")}
      >
        {draft.messages.map((m, i) => (
          <div key={i} className="obot-line">
            <textarea
              className="input"
              rows={2}
              maxLength={BOT_LIMITS.welcomeMessage}
              aria-label={uiText("workspace.interface.greeting_value0_88fbf4f", { value0: i + 1 })}
              value={m}
              onChange={(e) => setLine(i, e.target.value)}
            />
            {draft.messages.length > 1 && (
              <button
                type="button"
                className="icon-btn icon-btn-xs"
                aria-label={uiText("workspace.interface.remove_greeting_value0_7b1f5ba", { value0: i + 1 })}
                onClick={() => set({ messages: draft.messages.filter((_, j) => j !== i) })}
              >
                <X size={14} />
              </button>
            )}
          </div>
        ))}
        <div className="row obot-row-wrap">
          <Placeholders items={WELCOME_PLACEHOLDERS} onPick={(p) => setLine(draft.messages.length - 1, `${draft.messages[draft.messages.length - 1] ?? ""}${p}`)} />
          <span className="grow" />
          <button type="button" className="btn btn-ghost btn-sm" disabled={draft.messages.length >= max || !botsPlus} onClick={() => set({ messages: [...draft.messages, ""] })}>
            <Localized k="workspace.interface.add_a_greeting_d73100f" slots={[<Plus size={14} />, <PlusChip />]} />
          </button>
        </div>
      </BotField>
      <div className="obot-preview" aria-label={uiText("organization.interface.preview_324b134")}>
        <small className="faint">
          <Localized k="organization.interface.preview_324b134" />
        </small>
        <p>
          {preview || (
            <span className="faint">
              <Localized k="workspace.interface.write_a_greeting_to_see_it_here_dde5a3e" />
            </span>
          )}
        </p>
      </div>
      <div className="row obot-row-wrap">
        <button type="button" className="btn btn-secondary btn-sm" disabled={!ctx.enabled || ctx.dirty || test.busy} onClick={() => void sendTest()}>
          <Send size={14} /> {test.busy ? l10n("common.common_sending") : uiText("workspace.interface.send_a_test_edc0143")}
        </button>
        <small className="faint" role="status">
          {test.note ??
            (!ctx.enabled
              ? uiText("workspace.interface.turn_welcomer_on_to_send_a_test_2ae54b4")
              : ctx.dirty
                ? uiText("workspace.interface.save_first_the_test_uses_what_s_saved_ec5c7a8")
                : uiText("workspace.interface.welcomer_greets_you_as_it_would_a_newcomer_46c1226"))}
        </small>
      </div>
      <BotField
        label={uiText("workspace.interface.goodbye_c015ad6")}
        hint={uiText("workspace.interface.said_in_the_same_channel_when_someone_leaves_user_is_their_name_5331dfa")}
        plus
        botsPlus={botsPlus}
        paused={paused.includes("goodbye")}
      >
        <textarea
          className="input"
          rows={2}
          maxLength={BOT_LIMITS.welcomeMessage}
          aria-label={uiText("workspace.interface.goodbye_message_91537ab")}
          placeholder={uiText("workspace.interface.user_has_left_see_you_around_17b7766")}
          value={draft.goodbye ?? ""}
          onChange={(e) => set({ goodbye: e.target.value || null })}
        />
      </BotField>
    </>
  );
}
