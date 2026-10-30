import { Plus, X } from "lucide-react";
import { useState } from "react";
import { ALERT_PLACEHOLDERS, type AlertFeed, BOT_LIMITS, feedProblem } from "../../../sync/officialBotRules";
import { BotField, ChannelSelect, Placeholders } from "./BotParts";
import type { BotFormProps } from "./botForm";

/** Giveaways: anyone with Manage messages runs one with !giveaway. Plus: only some roles may enter. */
export function GiveawaysForm({ draft, set, botsPlus, paused, roles }: BotFormProps<"giveaways">) {
  return (
    <BotField label="Who may enter" hint="Bots never win, and winners must still be here." plus botsPlus={botsPlus} paused={paused.includes("requiredRoleId")}>
      <select className="input" aria-label="Role needed to enter" value={draft.requiredRoleId ?? ""} onChange={(e) => set({ requiredRoleId: e.target.value || null })}>
        <option value="">Everyone</option>
        {roles.map((r) => (
          <option key={r.id} value={r.id}>
            Only people with {r.name}
          </option>
        ))}
      </select>
    </BotField>
  );
}

const EMPTY_FEED: AlertFeed = { url: "", channelId: "", roleId: null };

/** Alerts: the YouTube channels followed (3, Plus 25), each posting in a channel with an optional ping; the message. */
export function AlertsForm({ draft, set, botsPlus, channels, roles }: BotFormProps<"alerts">) {
  const [adding, setAdding] = useState<AlertFeed>(EMPTY_FEED);
  const [problem, setProblem] = useState<string | null>(null);
  const max = botsPlus ? BOT_LIMITS.alertFeeds.plus : BOT_LIMITS.alertFeeds.free;
  const channelName = (id: string) => channels.find((c) => c.id === id)?.name ?? "deleted channel";
  const roleName = (id: string | null) => (id ? (roles.find((r) => r.id === id)?.name ?? "a deleted role") : null);
  const add = () => {
    const p = feedProblem(adding);
    setProblem(p);
    if (p) return;
    set({ feeds: [...draft.feeds, { ...adding, url: adding.url.trim() }] });
    setAdding(EMPTY_FEED);
  };
  return (
    <>
      <BotField label={`YouTube channels · ${draft.feeds.length} of ${max}`} hint="Checked every 10 minutes; only new uploads are posted." botsPlus={botsPlus}>
        <ul className="ws-list">
          {draft.feeds.map((f, i) => (
            <li key={`${f.url}-${i}`} className="ws-row">
              <span className="lines grow">
                <span className="ellipsis">{f.url}</span>
                <small>
                  #{channelName(f.channelId)}
                  {roleName(f.roleId) ? ` · pings @${roleName(f.roleId)}` : ""}
                </small>
              </span>
              <button type="button" className="icon-btn icon-btn-xs" aria-label={`Stop following ${f.url}`} onClick={() => set({ feeds: draft.feeds.filter((_, j) => j !== i) })}>
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
        {draft.feeds.length < max && (
          <div className="obot-feed-add">
            <input className="input" aria-label="YouTube channel link" placeholder="https://youtube.com/@channel" value={adding.url} onChange={(e) => setAdding({ ...adding, url: e.target.value })} />
            <ChannelSelect id="alerts-channel" value={adding.channelId || null} channels={channels} none="Post in…" onChange={(id) => setAdding({ ...adding, channelId: id ?? "" })} />
            <select className="input" aria-label="Ping role" value={adding.roleId ?? ""} onChange={(e) => setAdding({ ...adding, roleId: e.target.value || null })}>
              <option value="">No ping</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  @{r.name}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-secondary btn-sm" onClick={add}>
              <Plus size={14} /> Add
            </button>
          </div>
        )}
        {problem && <small className="field-error">{problem}</small>}
      </BotField>
      <BotField label="Message" hint="{creator} the channel's name, {title} the video, {url} its link, {role} the ping." botsPlus={botsPlus}>
        <textarea
          className="input"
          rows={2}
          maxLength={BOT_LIMITS.welcomeMessage}
          aria-label="Alert message"
          placeholder="{role} {creator} posted a new video: {title} {url}"
          value={draft.message ?? ""}
          onChange={(e) => set({ message: e.target.value || null })}
        />
        <Placeholders items={ALERT_PLACEHOLDERS} onPick={(p) => set({ message: `${draft.message ?? ""}${p}` })} />
      </BotField>
    </>
  );
}

/** Wordy: the channel where the daily word is played (its commands are listed by the window). */
export function WordyForm({ draft, set, botsPlus, channels }: BotFormProps<"wordy">) {
  return (
    <BotField label="Wordy channel" hint="A new word for everyone at 00:00 UTC, with a recap of the day before." botsPlus={botsPlus}>
      <ChannelSelect id="wordy-channel" value={draft.channelId} channels={channels} none="Pick a channel" onChange={(channelId) => set({ channelId })} />
    </BotField>
  );
}
