import { CharLimitNote, overCharLimit } from "../mojo/CharLimit";
import { useMojoLimits, useUploadLimit } from "../mojo/useMojoLimits";
import { size } from "../mojo/mojoFormat";
import { AtSign, BarChart3, FileUp, Paperclip, Lock, MapPin, Mic, SendHorizontal, UserRound, X } from "lucide-react";
import { useExpressions } from "../community/CustomEmoji";
import { forSending, refOf } from "../../sync/expressions";
import type { CustomEmojiRef } from "../../protocol/payload";
import { type ClipboardEvent, type DragEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Conversation, Member } from "../../api/schemas";
import { useEngine } from "../../application/orbit";
import { usePrefs } from "../../application/prefs";
import { ROUTE_EVENT } from "../../application/router";
import type { StoredMessage } from "../../model/types";
import type { RichContent } from "../../model/types";
import { fileLimit, MAX_FILES_PER_MESSAGE, sendFiles } from "../../sync/attachments";
import { AttachmentDrafts } from "./AttachmentDrafts";
import { inspectFile } from "../../sync/attachmentPolicy";
import { optimizeVideo } from "../../sync/videoQuality";
import { preparePhoto } from "../../sync/photoQuality";
import { UploadCancelled } from "../../sync/largeUpload";
import { transfersOf } from "../../sync/transfers";
import { TransferList } from "./TransferList";
import { fallbackText } from "../../sync/rich";
import { type Recording, voiceFileName, voiceMime } from "../../sync/voice";
import { activeMentionQuery } from "../../sync/mentions";
import { UserAvatar } from "../components/OrgAvatar";
import { Menu, useMenu } from "../components/Overlay";
import { PollDialog } from "./PollDialog";
import { ExpressionPicker, PICKER_BUTTONS, type PickerTab } from "./ExpressionPicker";
import { LocationDialog } from "./RichDialogs";
import { ProfileShareDialog } from "./ProfileCards";
import { VoiceBar } from "./VoiceBar";
import { slowmodeLabel, waitText } from "../../sync/communityRules";
import { untilWhen } from "../format";
import { useNow } from "../call/useNow";
import { useT } from "../../i18n";
import { SlashCommandList, useSlashCommands } from "./SlashCommands";
import { useWordyCommand } from "./wordyLaunch";
import { RulesAgreeBar, useRulesSummary } from "../community/RulesViews";
import { ComposerHoldBar, ComposerNoteLine, useComposerGates } from "./ComposerGates";
import { hasHeading, refusalText } from "../../sync/channelGates";
import { clearComposerNote, setComposerNote } from "../../sync/composerNotes";
import { type MentionRole, mentionableRoles, roleToken, rolesStillMentioned } from "../../sync/roleMentions";

/** A role in the mention list is shown among people with this id prefix. */
const ROLE_PREFIX = "role:";

interface ComposerProps {
  conversation: Conversation;
  title: string;
  replyTo: StoredMessage | null;
  replyName: string | null;
  onCancelReply: () => void;
  threadRoot?: string;
  /** Files dropped on the conversation. */
  dropped: File[];
  onDroppedTaken: () => void;
}

export function Composer(props: ComposerProps) {
  const { conversation: c } = props;
  const engine = useEngine();
  const planUploadLimit = useUploadLimit(c.type === "CHANNEL" ? c.orgId : null);
  const charLimit = useMojoLimits()?.messageChars ?? null;
  const prefs = usePrefs();
  const t = useT();
  // API 0.65.0: the community's rules channel, and whether this account must agree to its rules first.
  const rules = useRulesSummary(c.type === "CHANNEL" ? c.orgId : null);
  // Community parity A: what this person may send here, why posting is held back, and roles to mention.
  const gates = useComposerGates(c);
  const can = gates.abilities;
  const pickedRoles = useRef<MentionRole[]>([]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [photoQuality, setPhotoQuality] = useState<"original" | "auto">("auto");
  const preparing = useRef<AbortController | null>(null);
  useEffect(() => () => preparing.current?.abort(), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [suggest, setSuggest] = useState<{ start: number; items: Member[]; index: number } | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const emoji = useMenu();
  const [pickerTab, setPickerTab] = useState<PickerTab>("emoji");
  /** Puts [piece] where the caret was (replacing a selection), then puts the caret after it. */
  const insertAtCaret = (piece: string) => {
    const el = input.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    onChange(text.slice(0, start) + piece + text.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + piece.length, start + piece.length);
    });
  };
  const attach = useMenu();
  const [voice, setVoice] = useState(false);
  const [rich, setRich] = useState<"contact" | "location" | "poll" | null>(null);
  const canRecord = !props.threadRoot && voiceMime() !== null && can.voice;
  const draftTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingDraft = useRef<string | null>(null);
  const flushDraft = useCallback(() => {
    clearTimeout(draftTimer.current);
    if (!props.threadRoot && pendingDraft.current !== null) {
      void engine.saveDraft(c.id, pendingDraft.current);
      pendingDraft.current = null;
    }
  }, [c.id, engine, props.threadRoot]);
  // Batch B9: a community's own emoji and stickers in its channels; the ones picked for this message by name.
  const communityEmoji = useExpressions(c.type === "CHANNEL" ? c.orgId : null, true);
  const picked = useRef(new Map<string, CustomEmojiRef>());
  // Batch B3 slowmode: when this person may post next (the server's answer, or one interval after their last message).
  const slowed = c.type === "CHANNEL" && c.slowmodeSec > 0 && !c.slowmodeExempt;
  const [lastSent, setLastSent] = useState(0);
  const nextAt = slowed ? Math.max(c.nextPostAt ?? 0, lastSent + c.slowmodeSec * 1000) : 0;
  const now = useNow(slowed && nextAt > Date.now());
  // API 0.65.0 batch B: "/" lists the commands of the bots in this channel; sending one runs it.
  const slash = useSlashCommands(c, props.threadRoot ? "" : text, (t) => onChange(t), members);
  const wordy = useWordyCommand(c);

  // Draft: restored when the conversation opens, saved as you type (main composer only).
  useEffect(() => {
    if (props.threadRoot) return;
    const l = engine.state.get().local[c.id];
    setText(l?.draft ?? "");
    // Opening a conversation on touch should leave its history visible until the person chooses to type.
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) input.current?.focus({ preventScroll: true });
    const hidden = () => {
      if (document.visibilityState === "hidden") flushDraft();
    };
    window.addEventListener("pagehide", flushDraft);
    window.addEventListener(ROUTE_EVENT, flushDraft);
    window.addEventListener("popstate", flushDraft);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      flushDraft();
      engine.setTyping(c.id, false);
      window.removeEventListener("pagehide", flushDraft);
      window.removeEventListener(ROUTE_EVENT, flushDraft);
      window.removeEventListener("popstate", flushDraft);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [c.id, engine, props.threadRoot, flushDraft]);

  useEffect(() => {
    if (c.type === "DM") return;
    engine
      .membersOf(c.id)
      .then(setMembers)
      .catch(() => setMembers([]));
  }, [c.id, c.type, engine]);

  useEffect(() => {
    if (props.dropped.length) {
      addFiles(props.dropped);
      props.onDroppedTaken();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.dropped]);

  useEffect(() => {
    if (props.replyTo) input.current?.focus();
  }, [props.replyTo]);

  const autosize = useCallback(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    const limit = parseFloat(getComputedStyle(el).maxHeight) || 220;
    el.style.height = `${Math.min(el.scrollHeight, limit)}px`;
  }, []);
  useLayoutEffect(autosize, [text, autosize]);
  useEffect(() => {
    // Reflow wrapped lines on rotation and keyboard resizing, even when the draft hasn't changed.
    let frame = 0;
    const resize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(autosize);
    };
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
    };
  }, [autosize]);

  const addFiles = useCallback(
    (list: File[]) => {
      if (!can.attach) return engine.notice("error", "You can't share files in this channel.");
      if (list.some((f) => f.size === 0)) engine.notice("error", "Empty files cannot be sent.");
      if (files.length + list.length > MAX_FILES_PER_MESSAGE) engine.notice("info", `Send up to ${MAX_FILES_PER_MESSAGE} files per message. Extra files were left out.`);
      const serverLimit = fileLimit(engine.state.get().server);
      // Meldiq Plus (server docs/MOJO.md): the person's plan, or the community's Sparks, may set a lower limit.
      const limit = planUploadLimit === null ? serverLimit : Math.min(serverLimit, planUploadLimit);
      const tooBig = list.find((f) => f.size > limit);
      if (tooBig) {
        engine.notice(
          "error",
          planUploadLimit !== null && limit === planUploadLimit
            ? `"${tooBig.name}" is larger than ${size(limit)}, the limit on your plan here. Meldiq Plus raises it, and so do a community's Sparks.`
            : `"${tooBig.name}" is larger than this server accepts (${Math.floor(limit / (1024 * 1024))} MB per file).`,
        );
      }
      if (!files.length) setPhotoQuality("auto");
      // One picker accepts every type. Detect bounded signatures before showing previews or quality controls.
      void Promise.all(
        list
          .filter((f) => f.size <= limit && f.size > 0)
          .slice(0, MAX_FILES_PER_MESSAGE)
          .map(inspectFile),
      )
        .then((detected) => setFiles((cur) => [...cur, ...detected].slice(0, MAX_FILES_PER_MESSAGE)))
        .catch(() => engine.notice("error", "Couldn't read that file. Choose it again."));
    },
    [engine, planUploadLimit, can.attach, files.length],
  );

  const onChange = (value: string) => {
    setText(value);
    if (!props.threadRoot) {
      clearTimeout(draftTimer.current);
      pendingDraft.current = value;
      draftTimer.current = setTimeout(flushDraft, 400);
    }
    engine.setTyping(c.id, value.trim().length > 0);
    const caret = input.current?.selectionStart ?? value.length;
    const q = c.type === "DM" ? null : activeMentionQuery(value, caret);
    if (!q) return setSuggest(null);
    const pool = [...members.filter((m) => m.id !== engine.device.userId)];
    const roleItems = mentionableRoles(gates.roles, true, q.query).map((r) => ({ id: `${ROLE_PREFIX}${r.id}`, username: r.name, displayName: `@${r.name}`, avatarColor: 7 }) as Member);
    const items = [
      ...(c.canMentionAll && "everyone".startsWith(q.query) ? [{ id: "everyone", username: "everyone", displayName: "Everyone in this conversation", avatarColor: 7 } as Member] : []),
      ...roleItems.slice(0, 3),
      ...pool.filter((m) => m.username.toLowerCase().startsWith(q.query) || m.displayName.toLowerCase().includes(q.query)),
    ].slice(0, 8);
    setSuggest(items.length ? { start: q.start, items, index: 0 } : null);
  };

  const pick = (m: Member) => {
    if (!suggest) return;
    const caret = input.current?.selectionStart ?? text.length;
    const role = m.id.startsWith(ROLE_PREFIX) ? gates.roles.find((r) => `${ROLE_PREFIX}${r.id}` === m.id) : undefined;
    if (role) pickedRoles.current = [...pickedRoles.current.filter((r) => r.id !== role.id), role];
    const token = role ? roleToken(role.name) : `@${m.username}`;
    const next = `${text.slice(0, suggest.start)}${token} ${text.slice(caret)}`;
    onChange(next);
    setSuggest(null);
    requestAnimationFrame(() => {
      const pos = suggest.start + token.length + 1;
      input.current?.setSelectionRange(pos, pos);
      input.current?.focus();
    });
  };

  const send = async () => {
    const body = text.trim();
    if ((!body && !files.length) || busy) return;
    // Over the plan's characters (server docs/MOJO.md): the note under the box says so; nothing is cut off.
    if (overCharLimit(body, charLimit)) return;
    // Community parity A1: headings need Use Big Text; said here instead of after the server refuses.
    if (!can.headings && hasHeading(body)) return setComposerNote(c.id, refusalText("headings_not_allowed") ?? "Headings aren't allowed here.");
    clearComposerNote(c.id);
    if (!files.length && !props.threadRoot && body.startsWith("/")) {
      // Community parity D: `/wordy` opens the private game panel, so guesses never show in the channel.
      const ran = wordy(body) ? "sent" : await slash.run(body);
      if (ran === "kept") return;
      if (ran === "sent") {
        clearTimeout(draftTimer.current);
        pendingDraft.current = null;
        setText("");
        void engine.saveDraft(c.id, "");
        engine.setTyping(c.id, false);
        return;
      }
    }
    clearTimeout(draftTimer.current); // before anything async: a pending draft save must not bring the text back
    pendingDraft.current = null;
    const opts = { replyTo: props.replyTo?.id, threadRoot: props.threadRoot };
    // The box empties at once (the message shows as Sending), so whatever is typed while it encrypts and goes out
    // starts the next message instead of joining this one or being wiped when this one finishes.
    setText("");
    if (!props.threadRoot) void engine.saveDraft(c.id, "");
    try {
      if (files.length) {
        setBusy("Preparing uploads…");
        // One at a time: decoding several large photos at once can run a phone's browser out of memory.
        const prepared: File[] = [];
        preparing.current = new AbortController();
        for (const f of files) {
          const inspected = await inspectFile(f);
          const optimized =
            photoQuality !== "original" && inspected.type.startsWith("video/")
              ? await optimizeVideo(inspected, preparing.current.signal, (percent) => setBusy(`Optimizing video… ${percent}%`))
              : await preparePhoto(inspected, photoQuality);
          if (preparing.current.signal.aborted) throw new UploadCancelled();
          prepared.push(optimized);
        }
        preparing.current = null;
        // The transfer belongs to the app (sync/transfers.ts): it keeps going, with its progress shown above this box,
        // if this conversation is left; the same send while it runs joins it rather than starting another.
        await transfersOf(engine).start(
          c.id,
          prepared.map((f) => ({ name: f.name, type: f.type, size: f.size, lastModified: f.lastModified, source: f })),
          body,
          opts,
        );
      } else {
        // Batch B9: the community emoji the text still names go with it (id, community and image hash).
        const customEmoji = forSending(body, picked.current.values());
        const roleMentions = rolesStillMentioned(body, pickedRoles.current);
        pickedRoles.current = [];
        await engine.sendText(c.id, body, { ...opts, ...(customEmoji.length ? { rich: { customEmoji } } : {}), ...(roleMentions.length ? { roleMentions } : {}) });
      }
      if (slowed && !props.threadRoot) setLastSent(Date.now());
      setFiles([]);
      setPhotoQuality("auto");
      props.onCancelReply();
      engine.setTyping(c.id, false);
    } catch (e) {
      // Not sent: the text comes back unless something new has been typed meanwhile.
      const restored = input.current?.value || body;
      setText(restored);
      if (!props.threadRoot) void engine.saveDraft(c.id, restored);
      if (!(e instanceof UploadCancelled) && !(e instanceof DOMException && e.name === "AbortError")) engine.notice("error", e instanceof Error ? e.message : "Couldn't send.");
    } finally {
      preparing.current = null;
      setBusy(null);
      input.current?.focus();
    }
  };

  /** A voice message (android VoiceViews): an encrypted audio attachment marked voice, with its length. */
  const sendVoice = async (rec: Recording) => {
    const opts = { replyTo: props.replyTo?.id, threadRoot: props.threadRoot };
    try {
      await sendFiles(
        engine,
        c.id,
        [{ name: voiceFileName(rec.mime), type: rec.mime, size: rec.blob.size, bytes: async () => new Uint8Array(await rec.blob.arrayBuffer()), voiceDurationMs: rec.durationMs }],
        "",
        opts,
      );
      props.onCancelReply();
      setVoice(false);
    } catch (e) {
      engine.notice("error", e instanceof Error ? e.message : "Couldn't send the voice message.");
    }
  };

  /** A contact card or location: inside the encrypted message, with a readable text for apps that don't show it. */
  const sendRich = async (content: RichContent) => {
    setRich(null);
    try {
      await engine.sendText(c.id, fallbackText(content), { rich: content, replyTo: props.replyTo?.id, threadRoot: props.threadRoot });
      props.onCancelReply();
    } catch (e) {
      engine.notice("error", e instanceof Error ? e.message : "Couldn't send.");
    }
  };

  if (rules?.mustAgree && c.orgId && !c.archived) return <RulesAgreeBar orgId={c.orgId} />;
  if (gates.hold && c.orgId && !c.archived) return <ComposerHoldBar hold={gates.hold} org={{ id: c.orgId }} />;

  if (!c.canPost) {
    return (
      <div className="composer-wrap">
        <div className="composer-locked" role="note">
          <Lock size={16} />
          {c.archived
            ? "This channel is archived. You can read it, but nobody can post."
            : c.timedOutUntil && c.timedOutUntil > Date.now()
              ? `You're timed out in this community until ${untilWhen(c.timedOutUntil)}. You can read, but not post.`
              : rules?.channelId === c.id
                ? t("rules_channel_locked")
                : c.kind === "ANNOUNCEMENT"
                  ? "Only the people who manage this announcement channel can post here."
                  : "You can't post in this conversation."}
        </div>
      </div>
    );
  }

  return (
    <div className="composer-wrap">
      <TransferList conversationId={c.id} />
      <SlashCommandList slash={slash} />
      {suggest && (
        <div className="suggest card" role="listbox" aria-label="People to mention">
          {suggest.items.map((m, i) => (
            <button key={m.id} role="option" aria-selected={i === suggest.index} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(m)}>
              {m.id === "everyone" || m.id.startsWith(ROLE_PREFIX) ? (
                <AtSign size={18} />
              ) : (
                <UserAvatar userId={m.id} name={m.displayName} colorIndex={m.avatarColor} photoRev={m.photoRev} size={24} decorative />
              )}
              <span className="grow ellipsis">{m.displayName}</span>
              <span className="faint">{m.id.startsWith(ROLE_PREFIX) ? "Role" : `@${m.username}`}</span>
            </button>
          ))}
        </div>
      )}
      {gates.note && <ComposerNoteLine conversationId={c.id} note={gates.note} />}
      {slowed && (
        <div className="composer-slowmode" role="status" aria-live="polite">
          {nextAt > now ? `Slowmode · you can send again in ${waitText(nextAt, now)}. Messages you send now go out then.` : `Slowmode is on: one message every ${slowmodeLabel(c.slowmodeSec)}.`}
        </div>
      )}
      <div className="composer">
        {props.replyTo && (
          <div className="composer-context">
            <span className="grow ellipsis">
              {t("composer_replying")} <b>{props.replyName}</b>: {props.replyTo.text || t("composer_attachment")}
            </span>
            <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={props.onCancelReply} aria-label="Cancel reply">
              <X size={14} />
            </button>
          </div>
        )}
        {files.length > 0 && (
          <>
            <AttachmentDrafts files={files} disabled={!!busy} onRemove={(index) => setFiles((cur) => cur.filter((_, i) => i !== index))} />
            {files.some((f) => f.type.startsWith("image/") || f.type.startsWith("video/")) && (
              <div className="attachment-quality">
                <label>
                  <input type="checkbox" checked={photoQuality === "original"} disabled={!!busy} onChange={(e) => setPhotoQuality(e.target.checked ? "original" : "auto")} />
                  Original file
                </label>
                <small>
                  {photoQuality === "original"
                    ? "Send unchanged files, including any saved location metadata."
                    : "Photos and videos are optimized automatically. Animations and already efficient files keep their quality."}
                </small>
              </div>
            )}
          </>
        )}
        {voice ? (
          <VoiceBar onSend={sendVoice} onClose={() => setVoice(false)} />
        ) : (
          <>
            <label className="sr-only" htmlFor={`composer-${c.id}-${props.threadRoot ?? "main"}`}>
              {props.threadRoot ? "Reply in thread" : `Message ${props.title}`}
            </label>
            {/* B14 (android one-row composer): actions, the text, emoji, and the microphone that becomes Send. */}
            <div className="composer-row">
              <button
                className={`composer-file-button${attach.anchor ? " open" : ""}`}
                onClick={(e) => attach.open(e.currentTarget)}
                aria-label={t("composer_add")}
                aria-haspopup="menu"
                aria-expanded={!!attach.anchor}
                title={t("composer_add")}
                disabled={!!busy}
              >
                <Paperclip size={18} aria-hidden="true" />
                <span>{t("composer_file")}</span>
              </button>
              <input
                ref={fileInput}
                type="file"
                multiple
                hidden
                aria-label="Choose files"
                onChange={(e) => {
                  addFiles(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />
              <textarea
                id={`composer-${c.id}-${props.threadRoot ?? "main"}`}
                ref={input}
                rows={1}
                autoCapitalize="sentences"
                enterKeyHint={prefs.enterToSend ? "send" : "enter"}
                spellCheck
                value={text}
                placeholder={props.threadRoot ? t("composer_thread") : t("composer_message", { name: `${c.type === "CHANNEL" ? "#" : ""}${props.title}` })}
                onChange={(e) => onChange(e.target.value)}
                onBlur={() => {
                  flushDraft();
                  engine.setTyping(c.id, false);
                }}
                onPaste={(e: ClipboardEvent<HTMLTextAreaElement>) => {
                  const pasted = Array.from(e.clipboardData.files);
                  if (pasted.length) {
                    e.preventDefault();
                    addFiles(pasted);
                  }
                }}
                onKeyDown={(e) => {
                  if (slash.onKey(e)) return;
                  if (suggest) {
                    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                      e.preventDefault();
                      const d = e.key === "ArrowDown" ? 1 : -1;
                      setSuggest({ ...suggest, index: (suggest.index + d + suggest.items.length) % suggest.items.length });
                      return;
                    }
                    if (e.key === "Enter" || e.key === "Tab") {
                      e.preventDefault();
                      pick(suggest.items[suggest.index]);
                      return;
                    }
                    if (e.key === "Escape") {
                      setSuggest(null);
                      return;
                    }
                  }
                  if (e.key === "Escape" && props.replyTo) props.onCancelReply();
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && (prefs.enterToSend || e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void send();
                  }
                }}
                aria-describedby={busy ? `composer-status-${c.id}` : undefined}
                disabled={!!busy}
              />
              {/* Emoji → GIFs → Stickers (continuation brief v3 §11), each opening the same picker on its tab. */}
              {PICKER_BUTTONS.filter((b) => b.tab === "emoji" || (c.canPost && (b.tab === "gifs" ? can.gifs : can.stickers))).map((b) => (
                <button
                  key={b.tab}
                  className={`icon-btn${b.tab === "emoji" ? "" : " hide-xs"}`}
                  onClick={(e) => {
                    setPickerTab(b.tab);
                    emoji.open(e.currentTarget);
                  }}
                  aria-label={b.tab === "emoji" ? "Insert emoji" : b.label}
                  title={b.label}
                  aria-haspopup="dialog"
                  aria-expanded={!!emoji.anchor && pickerTab === b.tab}
                >
                  {b.icon}
                </button>
              ))}
              {c.type !== "DM" && (
                <button
                  className="icon-btn hide-sm"
                  aria-label="Mention someone"
                  onClick={() => {
                    const next = `${text}${text && !text.endsWith(" ") ? " " : ""}@`;
                    setText(next);
                    requestAnimationFrame(() => {
                      input.current?.focus();
                      input.current?.setSelectionRange(next.length, next.length);
                      onChange(next);
                    });
                  }}
                >
                  <AtSign size={18} />
                </button>
              )}
              {canRecord && !text.trim() && !files.length && !busy ? (
                <button key="mic" className="send-btn" onClick={() => setVoice(true)} aria-label={t("composer_voice")}>
                  <Mic size={17} />
                </button>
              ) : (
                <button
                  key="send"
                  className="send-btn"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => void send()}
                  disabled={(!text.trim() && !files.length) || !!busy}
                  aria-label={t("composer_send")}
                  title={prefs.enterToSend ? "Send (Enter) · Shift+Enter for a new line" : "Send (Ctrl+Enter)"}
                >
                  <SendHorizontal size={17} />
                </button>
              )}
            </div>
            <CharLimitNote text={text} limit={charLimit} />
            {busy && (
              <div className="composer-status" id={`composer-status-${c.id}`} aria-live="polite">
                <span className="grow">{busy}</span>
                {preparing.current && (
                  <button type="button" className="text-btn" onClick={() => preparing.current?.abort()}>
                    Cancel
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {attach.anchor && (
        <Menu
          anchor={attach.anchor}
          label="Attach"
          onClose={attach.close}
          entries={[
            { heading: "Share something" },
            ...(can.attach
              ? [
                  {
                    label: t("composer_file"),
                    hint: "Photos, videos and documents",
                    icon: <FileUp size={22} aria-hidden="true" />,
                    className: "attachment-file-option",
                    onSelect: () => fileInput.current?.click(),
                  },
                  "separator" as const,
                ]
              : []),
            ...(can.polls ? [{ label: "Poll…", icon: <BarChart3 size={16} />, onSelect: () => setRich("poll") }] : []),
            { label: "Share a profile…", icon: <UserRound size={16} />, onSelect: () => setRich("contact") },
            { label: "Location…", icon: <MapPin size={16} />, onSelect: () => setRich("location") },
          ]}
        />
      )}
      {rich === "contact" && <ProfileShareDialog onClose={() => setRich(null)} onSend={(contact) => void sendRich({ contact })} />}
      {rich === "location" && <LocationDialog onClose={() => setRich(null)} onSend={(location) => void sendRich({ location })} />}
      {rich === "poll" && <PollDialog onClose={() => setRich(null)} onSend={(poll) => void sendRich({ poll })} />}
      {emoji.anchor && (
        <ExpressionPicker
          anchor={emoji.anchor}
          tab={pickerTab}
          onTab={setPickerTab}
          onClose={emoji.close}
          canSend={props.conversation.canPost}
          allowedTabs={["emoji", ...(can.gifs ? (["gifs"] as const) : []), ...(can.stickers ? (["stickers"] as const) : [])]}
          onEmoji={(em) => {
            emoji.close();
            insertAtCaret(em);
          }}
          library={{ currentOrgId: c.type === "CHANNEL" ? c.orgId : null, externalAllowed: can.externalEmoji }}
          community={{
            list: communityEmoji ?? { expressions: [], limits: { emoji: 50, sticker: 20 } },
            onEmoji: (e) => {
              emoji.close();
              picked.current.set(e.name, refOf(e));
              insertAtCaret(`:${e.name}: `);
            },
            onSticker: (e) => {
              emoji.close();
              void engine
                .sendText(c.id, `:${e.name}:`, { rich: { customSticker: refOf(e) }, replyTo: props.replyTo?.id, threadRoot: props.threadRoot })
                .then(() => {
                  props.onCancelReply();
                  if (slowed && !props.threadRoot) setLastSent(Date.now());
                })
                .catch((err: unknown) => engine.notice("error", err instanceof Error ? err.message : "Couldn't send the sticker."));
            },
          }}
          onSticker={(pack, id) => {
            emoji.close();
            void sendRich({ sticker: { pack, id } });
          }}
          onAnimoji={(em) => {
            emoji.close();
            void sendRich({ animoji: em });
          }}
          onGif={(g, provider) => {
            emoji.close();
            const gif = { provider, id: g.id, url: g.gif.url, width: Math.max(1, Math.round(g.gif.width)), height: Math.max(1, Math.round(g.gif.height)), title: g.title || undefined };
            // The text is the GIF's address, so apps that don't show GIFs show the link.
            void engine
              .sendText(c.id, gif.url, { rich: { gif }, replyTo: props.replyTo?.id, threadRoot: props.threadRoot })
              .then(() => props.onCancelReply())
              .catch((err: unknown) => engine.notice("error", err instanceof Error ? err.message : "Couldn't send the GIF."));
          }}
        />
      )}
    </div>
  );
}

/** Lets the whole conversation accept dropped files. */
export function useFileDrop(enabled: boolean): { over: boolean; dropped: File[]; take: () => void; handlers: Record<string, (e: DragEvent) => void> } {
  const [over, setOver] = useState(false);
  const [dropped, setDropped] = useState<File[]>([]);
  const depth = useRef(0);
  const has = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
  return {
    over,
    dropped,
    take: () => setDropped([]),
    handlers: enabled
      ? {
          onDragEnter: (e) => {
            if (!has(e)) return;
            e.preventDefault();
            depth.current++;
            setOver(true);
          },
          onDragOver: (e) => has(e) && e.preventDefault(),
          onDragLeave: () => {
            depth.current = Math.max(0, depth.current - 1);
            if (!depth.current) setOver(false);
          },
          onDrop: (e) => {
            if (!has(e)) return;
            e.preventDefault();
            depth.current = 0;
            setOver(false);
            setDropped(Array.from(e.dataTransfer.files));
          },
        }
      : {},
  };
}
