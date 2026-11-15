import { useLocaleRender, Localized } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Bot, Terminal, X } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import type { Conversation, Member } from "../../api/schemas";
import { config } from "../../application/config";
import { useEngine, useOrbit } from "../../application/orbit";
import { communityCommands, directCommandDraft, matchingCommands, type OrgCommand, parseCommand, runCommand, validateCommandOptions } from "../../sync/bots";
import { Dialog } from "../components/Overlay";
import { BotTag } from "../people/NameStyle";

const NO_REPLIES: never[] = [];
const NO_COMMANDS: OrgCommand[] = [];
const PREFIX = /^\/[a-z0-9-]{0,32}$/i;
const COMMAND_LINE = /^\/[a-z0-9-]{1,32}(?:\s|$)/i;
const NAMED_OPTIONS = /^\/[a-z0-9-]{1,32}\s+[a-z0-9-]{1,32}:/i;

type Catalog = { scope: string; commands: OrgCommand[] } | { scope: string; failed: true };
type Picker = { scope: string; command?: OrgCommand };

export function useSlashCommands(c: Conversation, text: string, setText: (text: string) => void, members: readonly Member[], enabled: boolean) {
  const engine = useEngine();
  const direct = config().directBotCommands;
  const orgId = useOrbit((s) => {
    if (!enabled || !s.server?.features.includes("bots")) return null;
    if (c.type === "CHANNEL") return c.orgId;
    if (c.type !== "DM" || !direct || !s.server.features.includes("bot-direct-messages")) return null;
    const botPeer = c.members?.some((member) => member.id === direct.botId && (member.bot || s.users[member.id]?.bot));
    return botPeer && s.orgs.some((org) => org.id === direct.communityId) ? direct.communityId : null;
  });
  const channelId = c.type === "CHANNEL" ? c.id : null;
  const botId = c.type === "DM" ? direct?.botId : undefined;
  const scope = orgId ? `${c.id}/${orgId}/${botId ?? ""}` : null;
  const id = useId();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [closedAt, setClosedAt] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const form = picker && picker.scope === scope ? picker.command : undefined;
  const menuOpen = picker !== null && picker.scope === scope && !form;
  const inlineOpen = !!scope && !menuOpen && !form && PREFIX.test(text) && closedAt !== text;
  const open = inlineOpen || menuOpen;
  const scoped = catalog?.scope === scope ? catalog : null;
  const failed = scoped !== null && "failed" in scoped;
  const commands = scoped && "commands" in scoped ? scoped.commands : NO_COMMANDS;
  const items = menuOpen ? matchingCommands(commands, "/", commands.length) : matchingCommands(commands, text);
  const at = Math.min(index, Math.max(items.length - 1, 0));

  // Escape dismisses one draft, and editing that draft allows the picker to open again.
  useEffect(() => {
    setClosedAt(null);
    setIndex(0);
  }, [c.id, text]);
  useEffect(() => {
    if (!open || !orgId || !scope) return;
    let live = true;
    void communityCommands(engine, orgId, channelId ?? undefined).then(
      (list) => {
        if (live) setCatalog({ scope, commands: botId ? list.filter((cmd) => cmd.botId === botId) : list });
      },
      () => {
        if (live) setCatalog({ scope, failed: true });
      },
    );
    return () => {
      live = false;
    };
  }, [engine, open, orgId, scope, channelId, botId, attempt]);

  const retry = () => {
    setCatalog(null);
    setAttempt((previous) => previous + 1);
  };
  const pick = (command: OrgCommand) => {
    if (scope) setPicker({ scope, command });
    setClosedAt(text);
  };
  const close = useCallback(() => setPicker(null), []);
  const showMenu = () => {
    if (scope) setPicker({ scope });
  };
  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!inlineOpen) return false;
    if (event.key === "Escape") {
      event.preventDefault();
      setClosedAt(text);
      return true;
    }
    if (items.length && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      const next = (at + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      setIndex(next);
      document.getElementById(`${id}-${next}`)?.scrollIntoView({ block: "nearest" });
      return true;
    }
    if (items.length && (event.key === "Enter" || event.key === "Tab")) {
      event.preventDefault();
      pick(items[at]);
      return true;
    }
    return false;
  };
  const userId = (username: string) => members.find((m) => m.username.toLowerCase() === username.toLowerCase())?.id ?? null;
  const execute = async (command: OrgCommand, options: Record<string, string | number | boolean>) => {
    if (!channelId) return;
    await runCommand(engine, { channelId, botId: command.botId, command: command.name, options });
  };
  const run = async (body: string): Promise<"sent" | "kept" | "message"> => {
    if (!scope || !orgId || !channelId) return "message";
    if (body === "/") return "kept";
    if (!COMMAND_LINE.test(body)) return "message";
    const unavailable = () => {
      engine.notice("error", uiText("messaging.slash_commands.load_failed"));
      return "kept" as const;
    };
    let list = commands;
    if (!scoped || failed) {
      try {
        list = await communityCommands(engine, orgId, channelId);
        setCatalog({ scope, commands: list });
      } catch {
        setCatalog({ scope, failed: true });
        return unavailable();
      }
    }
    const parsed = parseCommand(body, list, null, userId);
    if (!parsed) {
      if (!NAMED_OPTIONS.test(body)) return "message";
      engine.notice("error", uiText("messaging.slash_commands.unavailable"));
      return "kept";
    }
    if ("problem" in parsed) {
      engine.notice("error", parsed.problem);
      return "kept";
    }
    try {
      await execute(parsed.command, parsed.options);
      return "sent";
    } catch (error) {
      engine.notice("error", commandError(error, parsed.command));
      return "kept";
    }
  };
  const submit = async (command: OrgCommand, given: Map<string, string>): Promise<string | null> => {
    if (!scope) return uiText("messaging.slash_commands.unavailable");
    // DM commands are ordinary drafts. Preserve the recipient and message exactly as entered.
    const parsed = validateCommandOptions(command, given, channelId ? userId : (username) => `@${username}`);
    if ("problem" in parsed) return parsed.problem;
    if (channelId) {
      try {
        await execute(command, parsed.options);
      } catch (error) {
        return commandError(error, command);
      }
    } else {
      if (text.trim() && !text.startsWith("/")) return uiText("messaging.slash_commands.finish_draft");
      setText(directCommandDraft(command, given));
    }
    return null;
  };
  const complete = () => {
    if (channelId && text.startsWith("/")) setText("");
    close();
  };
  return {
    available: !!scope,
    direct: !channelId,
    id,
    inlineOpen,
    menuOpen,
    form,
    loading: scoped === null,
    failed,
    items,
    index: at,
    activeId: inlineOpen && items.length ? `${id}-${at}` : undefined,
    pick,
    retry,
    showMenu,
    close,
    onKey,
    run,
    submit,
    complete,
  };
}

function commandError(error: unknown, command: OrgCommand): string {
  return error instanceof Error ? error.message : uiText("messaging.interface.couldn_t_run_value0_4954aff", { value0: command.name });
}

type SlashCommands = ReturnType<typeof useSlashCommands>;

export function SlashCommandButton({ slash, disabled }: { slash: SlashCommands; disabled: boolean }) {
  if (!slash.available) return null;
  return (
    <button type="button" className="composer-command-button" onClick={slash.showMenu} aria-haspopup="dialog" disabled={disabled}>
      <Terminal size={15} aria-hidden="true" />
      {uiText("workspace.interface.commands_b269dc4")}
    </button>
  );
}

function CommandCatalog({ slash, inline = false }: { slash: SlashCommands; inline?: boolean }) {
  if (slash.loading)
    return (
      <p className="slash-status" role="status">
        {uiText("messaging.interface.loading_value0_e87d0f1", { value0: uiText("workspace.interface.commands_10f5f77") })}
      </p>
    );
  if (slash.failed)
    return (
      <div className="slash-status">
        <p role="alert">{uiText("messaging.slash_commands.load_failed")}</p>
        <button type="button" className="btn btn-sm" onClick={slash.retry}>
          {uiText("common.actions.retry")}
        </button>
      </div>
    );
  if (!slash.items.length)
    return (
      <p className="slash-status" role="status">
        {uiText("messaging.slash_commands.no_commands")}
      </p>
    );
  return (
    <div className="slash-options" id={inline ? slash.id : undefined} role={inline ? "listbox" : undefined} aria-label={uiText("messaging.interface.bot_commands_cd2ff1d")}>
      {slash.items.map((cmd, i) => (
        <button
          type="button"
          key={`${cmd.botId}/${cmd.name}`}
          id={inline ? `${slash.id}-${i}` : undefined}
          role={inline ? "option" : undefined}
          aria-selected={inline ? i === slash.index : undefined}
          onMouseDown={inline ? (e) => e.preventDefault() : undefined}
          onClick={() => slash.pick(cmd)}
        >
          <Bot size={18} className="faint" aria-hidden="true" />
          <span className="grow lines">
            <span className="ellipsis">
              <strong>/{cmd.name}</strong>
            </span>
            <small className="ellipsis">{cmd.description}</small>
          </span>
          <span className="faint ellipsis">{cmd.botDisplayName}</span>
        </button>
      ))}
    </div>
  );
}

function CommandForm({ slash, command }: { slash: SlashCommands; command: OrgCommand }) {
  const [problem, setProblem] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(false);
  const id = useId();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    const values = new Map(Array.from(new FormData(event.currentTarget), ([name, value]) => [name, String(value)] as const).filter(([, value]) => value.trim() !== ""));
    inFlight.current = true;
    setRunning(true);
    setProblem(null);
    const failure = await slash.submit(command, values);
    if (!mounted.current) return;
    inFlight.current = false;
    setRunning(false);
    if (failure) setProblem(failure);
    else slash.complete();
  };
  return (
    <Dialog
      title={`/${command.name}`}
      subtitle={command.botDisplayName}
      onClose={() => {
        if (!inFlight.current) slash.close();
      }}
    >
      <form className="dialog-body slash-form" onSubmit={(event) => void submit(event)} aria-busy={running}>
        <p>{command.description}</p>
        {command.options.map((option, i) => {
          const fieldId = `${id}-${option.name}`;
          const shared = {
            id: fieldId,
            name: option.name,
            required: option.required,
            disabled: running,
            "aria-describedby": `${fieldId}-hint`,
            "data-autofocus": i === 0 ? true : undefined,
          };
          return (
            <div className="field" key={option.name}>
              <label htmlFor={fieldId}>
                {option.name}
                {!option.required && <small className="faint"> ({uiText("workspace.interface.optional_59be713")})</small>}
              </label>
              <p className="hint" id={`${fieldId}-hint`}>
                {option.description}
              </p>
              {option.type === "string" ? (
                <textarea className="input" {...shared} rows={2} maxLength={1000} dir="auto" />
              ) : option.type === "boolean" ? (
                <select className="input" {...shared} defaultValue="">
                  <option value="">{uiText("workspace.interface.choose_c7f9378")}</option>
                  <option value="true">{uiText("settings.interface.on_1300117")}</option>
                  <option value="false">{uiText("messaging.interface.off_ca7981b")}</option>
                </select>
              ) : (
                <input
                  className="input"
                  {...shared}
                  type={option.type === "number" ? "number" : "text"}
                  step={option.type === "number" ? "any" : undefined}
                  placeholder={option.type === "user" ? uiText("workspace.interface.a_person_username_a666966") : undefined}
                  dir="auto"
                />
              )}
            </div>
          );
        })}
        {problem && (
          <p className="field-error" role="alert">
            {problem}
          </p>
        )}
        <div className="slash-form-actions">
          <button type="button" className="btn" onClick={slash.close} disabled={running}>
            {uiText("common.actions.cancel")}
          </button>
          <button type="submit" className="btn btn-primary" disabled={running} data-autofocus={!command.options.length || undefined}>
            {uiText(slash.direct ? "messaging.slash_commands.insert" : "messaging.slash_commands.run")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function SlashCommandList({ slash }: { slash: SlashCommands }) {
  useLocaleRender();
  if (slash.form) return <CommandForm key={`${slash.form.botId}/${slash.form.name}`} slash={slash} command={slash.form} />;
  if (slash.menuOpen)
    return (
      <Dialog title={uiText("messaging.interface.bot_commands_cd2ff1d")} onClose={slash.close}>
        <div className="dialog-body">
          <CommandCatalog slash={slash} />
        </div>
      </Dialog>
    );
  return slash.inlineOpen ? (
    <div className="suggest card slash-list">
      <CommandCatalog slash={slash} inline />
    </div>
  ) : null;
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
