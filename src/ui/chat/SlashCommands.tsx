import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { Bot, X } from "lucide-react";
import { type KeyboardEvent, useEffect, useState } from "react";
import type { Conversation, Member } from "../../api/schemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { channelCommands, commandTemplate, matchingCommands, type OrgCommand, parseCommand, runCommand } from "../../sync/bots";
import { BotTag } from "../people/NameStyle";
const NO_REPLIES: never[] = [];
export interface SlashCommands {
  /** The commands matching what's typed, while a "/name" is being typed. */
  items: OrgCommand[];
  index: number;
  pick: (c: OrgCommand) => void;
  /** Arrow keys, Enter, Tab and Escape while the list shows; true when the key was used. */
  onKey: (e: KeyboardEvent<HTMLTextAreaElement>) => boolean;
  /**
   * Sends [body] as a command when it is one of a bot here: "sent", "kept" (something's wrong with it, said in a notice;
   * the text stays), or "message" (not a command: send it as an ordinary message).
   */
  run: (body: string) => Promise<"sent" | "kept" | "message">;
}
/**
 * The composer's slash commands (API 0.65.0 batch B): typing "/" in a community channel lists the commands of the bots
 * that can post there (loaded each time a "/" starts the box), picking one fills in its required options, and sending
 * runs it through the server instead of posting the text.
 */
export function useSlashCommands(c: Conversation, text: string, setText: (t: string) => void, members: readonly Member[]): SlashCommands {
  const engine = useEngine();
  const offered = useOrbit((s) => s.server?.features.includes("bots") ?? false);
  const orgId = offered && c.type === "CHANNEL" ? c.orgId : null;
  const [commands, setCommands] = useState<OrgCommand[]>([]);
  const [index, setIndex] = useState(0);
  const [closedAt, setClosedAt] = useState<string | null>(null);
  const [prefer, setPrefer] = useState<string | null>(null);
  const started = !!orgId && text.startsWith("/");
  useEffect(() => {
    if (!started || !orgId) return;
    let live = true;
    channelCommands(engine, orgId, c.id)
      .then((list) => live && setCommands(list))
      .catch(() => live && setCommands([]));
    return () => {
      live = false;
    };
  }, [started, orgId, c.id, engine]);
  const items = started && closedAt !== text ? matchingCommands(commands, text) : [];
  const at = Math.min(index, Math.max(items.length - 1, 0));
  const pick = (cmd: OrgCommand) => {
    setPrefer(cmd.botId);
    setIndex(0);
    setText(commandTemplate(cmd));
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!items.length) return false;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length);
      return true;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      pick(items[at]);
      return true;
    }
    if (e.key === "Escape") {
      setClosedAt(text);
      return true;
    }
    return false;
  };
  const run = async (body: string): Promise<"sent" | "kept" | "message"> => {
    if (!orgId || !body.startsWith("/")) return "message";
    const list = commands.length ? commands : await channelCommands(engine, orgId, c.id).catch(() => []);
    const userId = (username: string) => members.find((m) => m.username.toLowerCase() === username.toLowerCase())?.id ?? null;
    const parsed = parseCommand(body, list, prefer, userId);
    if (!parsed) return "message";
    if ("problem" in parsed) {
      engine.notice("error", parsed.problem);
      return "kept";
    }
    try {
      await runCommand(engine, { channelId: c.id, botId: parsed.command.botId, command: parsed.command.name, options: parsed.options });
      return "sent";
    } catch (e) {
      engine.notice("error", e instanceof Error ? e.message : uiText("messaging.interface.couldn_t_run_value0_4954aff", { value0: parsed.command.name }));
      return "kept";
    }
  };
  return { items, index: at, pick, onKey, run };
}
/** The list over the composer while "/name" is typed. */
export function SlashCommandList({ slash }: { slash: SlashCommands }) {
  useLocaleRender();
  if (!slash.items.length) return null;
  return (
    <div className="suggest card slash-list" role="listbox" aria-label={uiText("messaging.interface.bot_commands_cd2ff1d")}>
      {slash.items.map((cmd, i) => (
        <button key={`${cmd.botId}/${cmd.name}`} role="option" aria-selected={i === slash.index} onMouseDown={(e) => e.preventDefault()} onClick={() => slash.pick(cmd)}>
          <Bot size={18} className="faint" />
          <span className="grow lines">
            <span className="ellipsis">
              /{cmd.name}
              {cmd.options.length > 0 && <span className="faint"> {cmd.options.map((o) => (o.required ? `${o.name}:` : `[${o.name}:]`)).join(" ")}</span>}
            </span>
            <small className="ellipsis">{cmd.description}</small>
          </span>
          <span className="faint ellipsis">{cmd.botDisplayName}</span>
        </button>
      ))}
    </div>
  );
}
/** Bots' answers only you can see in this conversation (the `interaction.reply` frame), each dismissable. */
export function BotReplies({ conversationId }: { conversationId: string }) {
  useLocaleRender();
  const engine = useEngine();
  const replies = useOrbit((s) => s.botReplies[conversationId] ?? NO_REPLIES);
  const users = useOrbit((s) => s.users);
  if (!replies.length) return null;
  return (
    <ul className="bot-replies" aria-label={uiText("messaging.interface.answers_only_you_can_see_8402bcd")} aria-live="polite">
      {replies.map((r) => (
        <li key={r.interactionId} className="bot-reply">
          <span className="lines grow">
            <span className="bot-reply-head">
              <strong>{users[r.botId]?.displayName ?? uiText("messaging.interface.a_bot_7bcedea")}</strong> <BotTag />{" "}
              <span className="faint">{r.componentLabel ?? <Localized k="messaging.interface.answered_f5447c2" slots={[r.command]} />}</span>
            </span>
            <span className="bot-reply-text">{r.content}</span>
            <small className="faint">
              <Localized k="messaging.interface.only_you_can_see_this_84032e8" />
            </small>
          </span>
          <button className="icon-btn" aria-label={uiText("calls.interface.dismiss_48845bf")} onClick={() => engine.dismissBotReply(conversationId, r.interactionId)}>
            <X size={14} />
          </button>
        </li>
      ))}
    </ul>
  );
}
