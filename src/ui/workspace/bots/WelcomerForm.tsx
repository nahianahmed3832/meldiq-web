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
  const engine = useEngine();
  const me = useOrbit((s) => s.me);
  const [test, setTest] = useState<{ busy: boolean; note: string | null }>({ busy: false, note: null });
  const max = botsPlus ? BOT_LIMITS.welcomeLines.plus : BOT_LIMITS.welcomeLines.free;
  const setLine = (i: number, text: string) => set({ messages: draft.messages.map((m, j) => (j === i ? text : m)) });
  const preview = fillWelcome(draft.messages[0] ?? "", { user: me?.username ?? "you", name: me?.displayName ?? "You", server: ctx.orgName, count: ctx.memberCount });
  const sendTest = async () => {
    setTest({ busy: true, note: null });
    try {
      const sent = await testWelcomer(engine, ctx.orgId);
      const where = channels.find((c) => c.id === sent.channelId)?.name;
      setTest({ busy: false, note: `Sent${where ? ` to #${where}` : ""}. Have a look.` });
    } catch (e) {
      setTest({ busy: false, note: officialBotError(e) });
    }
  };

  return (
    <>
      <BotField label="Welcome channel" botsPlus={botsPlus}>
        <ChannelSelect id="welcomer-channel" value={draft.channelId} channels={channels} none="Automatic (#general)" onChange={(channelId) => set({ channelId })} />
      </BotField>
      <BotField
        label={draft.messages.length > 1 ? "Greetings (one picked at random)" : "Greeting"}
        hint={`Up to ${BOT_LIMITS.welcomeMessage} characters. {user} mentions them, {name} is their name, {server} this community, {count} how many people are here.`}
        botsPlus={botsPlus}
        paused={paused.includes("messages")}
      >
        {draft.messages.map((m, i) => (
          <div key={i} className="obot-line">
            <textarea className="input" rows={2} maxLength={BOT_LIMITS.welcomeMessage} aria-label={`Greeting ${i + 1}`} value={m} onChange={(e) => setLine(i, e.target.value)} />
            {draft.messages.length > 1 && (
              <button type="button" className="icon-btn icon-btn-xs" aria-label={`Remove greeting ${i + 1}`} onClick={() => set({ messages: draft.messages.filter((_, j) => j !== i) })}>
                <X size={14} />
              </button>
            )}
          </div>
        ))}
        <div className="row obot-row-wrap">
          <Placeholders items={WELCOME_PLACEHOLDERS} onPick={(p) => setLine(draft.messages.length - 1, `${draft.messages[draft.messages.length - 1] ?? ""}${p}`)} />
          <span className="grow" />
          <button type="button" className="btn btn-ghost btn-sm" disabled={draft.messages.length >= max || !botsPlus} onClick={() => set({ messages: [...draft.messages, ""] })}>
            <Plus size={14} /> Add a greeting <PlusChip />
          </button>
        </div>
      </BotField>
      <div className="obot-preview" aria-label="Preview">
        <small className="faint">Preview</small>
        <p>{preview || <span className="faint">Write a greeting to see it here.</span>}</p>
      </div>
      <div className="row obot-row-wrap">
        <button type="button" className="btn btn-secondary btn-sm" disabled={!ctx.enabled || ctx.dirty || test.busy} onClick={() => void sendTest()}>
          <Send size={14} /> {test.busy ? "Sending…" : "Send a test"}
        </button>
        <small className="faint" role="status">
          {test.note ?? (!ctx.enabled ? "Turn Welcomer on to send a test." : ctx.dirty ? "Save first: the test uses what's saved." : "Welcomer greets you as it would a newcomer.")}
        </small>
      </div>
      <BotField label="Goodbye" hint="Said in the same channel when someone leaves. {user} is their name." plus botsPlus={botsPlus} paused={paused.includes("goodbye")}>
        <textarea
          className="input"
          rows={2}
          maxLength={BOT_LIMITS.welcomeMessage}
          aria-label="Goodbye message"
          placeholder="{user} has left. See you around!"
          value={draft.goodbye ?? ""}
          onChange={(e) => set({ goodbye: e.target.value || null })}
        />
      </BotField>
    </>
  );
}
