import { AtSign, BarChart3, Bot, FileUp, Lock, MapPin, Mic, Paperclip, Plus, SendHorizontal, UserRound, X } from "lucide-react";
import { useExpressions } from "../community/CustomEmoji";
import { forSending, refOf } from "../../sync/expressions";
import type { CustomEmojiRef } from "../../protocol/payload";
import { type ClipboardEvent, type DragEvent, useCallback, useEffect, useRef, useState } from "react";
import type { Conversation, Member } from "../../api/schemas";
import { useEngine } from "../../application/orbit";
import { usePrefs } from "../../application/prefs";
import type { StoredMessage } from "../../model/types";
import type { RichContent } from "../../model/types";
import { fileLimit, MAX_FILES_PER_MESSAGE, sendFiles } from "../../sync/attachments";
import { type PhotoQuality, preparePhoto, QUALITY_LABEL, reencodable } from "../../sync/photoQuality";
import { UploadCancelled } from "../../sync/largeUpload";
import { transfersOf } from "../../sync/transfers";
import { TransferList } from "./TransferList";
import { fallbackText } from "../../sync/rich";
import { type Recording, voiceFileName, voiceMime } from "../../sync/voice";
import { activeMentionQuery } from "../../sync/mentions";
import { UserAvatar } from "../components/OrgAvatar";
import { Menu, useMenu } from "../components/Overlay";
import { bytes } from "../format";
import { PollDialog } from "./PollDialog";
import { ExpressionPicker, PICKER_BUTTONS, type PickerTab } from "./ExpressionPicker";
import { LocationDialog } from "./RichDialogs";
import { ProfileShareDialog } from "./ProfileCards";
import { VoiceBar } from "./VoiceBar";
import { slowmodeLabel, waitText } from "../../sync/communityRules";
import { untilWhen } from "../format";
import { useNow } from "../call/useNow";
import { useT } from "../../i18n";

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
  /**
   * AI Workforce: true when [text] asks an agent ("@Agent …", "/agent …"). It then opens the agent request (with its
   * notice) instead of being sent as an encrypted message.
   */
  onAgentRequest?: (text: string) => boolean;
  /** AI agents here that this person may ask: suggested after "@" and, as commands, after a leading "/". */
  agents?: { id: string; displayName: string; roleTitle: string }[];
}

/** An agent's command: its name in lower case letters and digits ("General Assistant" → "/generalassistant"). */
export const agentHandle = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "");
const AGENT_PREFIX = "agent:";

export function Composer(props: ComposerProps) {
  const { conversation: c } = props;
  const engine = useEngine();
  const prefs = usePrefs();
  const t = useT();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  // Starts at the default chosen in Settings › Appearance › Photo upload quality (android upload quality).
  const [quality, setQuality] = useState<PhotoQuality>(() => prefs.uploadQuality);
  const hasPhotos = files.some((f) => reencodable(f.type));
  const [busy, setBusy] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [suggest, setSuggest] = useState<{ start: number; items: Member[]; index: number; command?: boolean } | null>(null);
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
  const canRecord = !props.threadRoot && voiceMime() !== null;
  const draftTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Batch B9: a community's own emoji and stickers in its channels; the ones picked for this message by name.
  const communityEmoji = useExpressions(c.type === "CHANNEL" ? c.orgId : null);
  const picked = useRef(new Map<string, CustomEmojiRef>());
  // Batch B3 slowmode: when this person may post next (the server's answer, or one interval after their last message).
  const slowed = c.type === "CHANNEL" && c.slowmodeSec > 0 && !c.slowmodeExempt;
  const [lastSent, setLastSent] = useState(0);
  const nextAt = slowed ? Math.max(c.nextPostAt ?? 0, lastSent + c.slowmodeSec * 1000) : 0;
  const now = useNow(slowed && nextAt > Date.now());

  // Draft: restored when the conversation opens, saved as you type (main composer only).
  useEffect(() => {
    if (props.threadRoot) return;
    const l = engine.state.get().local[c.id];
    setText(l?.draft ?? "");
    input.current?.focus();
  }, [c.id, engine, props.threadRoot]);

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

  const autosize = () => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  };
  useEffect(autosize, [text]);

  const addFiles = useCallback(
    (list: File[]) => {
      const limit = fileLimit(engine.state.get().server);
      const tooBig = list.find((f) => f.size > limit);
      if (tooBig) engine.notice("error", `"${tooBig.name}" is larger than this server accepts (${Math.floor(limit / (1024 * 1024))} MB per file).`);
      setFiles((cur) => [...cur, ...list.filter((f) => f.size <= limit && f.size > 0)].slice(0, MAX_FILES_PER_MESSAGE));
    },
    [engine],
  );

  const onChange = (value: string) => {
    setText(value);
    if (!props.threadRoot) {
      clearTimeout(draftTimer.current);
      draftTimer.current = setTimeout(() => void engine.saveDraft(c.id, value), 400);
    }
    engine.setTyping(c.id, value.trim().length > 0);
    const caret = input.current?.selectionStart ?? value.length;
    const agentItems = (props.agents ?? []).map((a) => ({ id: `${AGENT_PREFIX}${a.id}`, username: a.displayName, displayName: `${a.displayName} · AI agent`, avatarColor: 5 }) as Member);
    // A leading "/": the agents' commands.
    const command = /^\/([a-z0-9]*)$/i.exec(value.slice(0, caret));
    if (command && agentItems.length) {
      const items = agentItems.filter((m) => agentHandle(m.username).startsWith(command[1]!.toLowerCase())).slice(0, 8);
      return setSuggest(items.length ? { start: 0, items, index: 0, command: true } : null);
    }
    const q = c.type === "DM" ? null : activeMentionQuery(value, caret);
    if (!q) return setSuggest(null);
    const pool = [...members.filter((m) => m.id !== engine.device.userId)];
    const items = [
      ...(c.canMentionAll && "everyone".startsWith(q.query) ? [{ id: "everyone", username: "everyone", displayName: "Everyone in this conversation", avatarColor: 7 } as Member] : []),
      ...agentItems.filter((m) => m.username.toLowerCase().startsWith(q.query) || agentHandle(m.username).startsWith(q.query)),
      ...pool.filter((m) => m.username.toLowerCase().startsWith(q.query) || m.displayName.toLowerCase().includes(q.query)),
    ].slice(0, 8);
    setSuggest(items.length ? { start: q.start, items, index: 0 } : null);
  };

  const pick = (m: Member) => {
    if (!suggest) return;
    const caret = input.current?.selectionStart ?? text.length;
    // An agent's command, or a mention (an agent by its display name, as agents recognise it; a person by username).
    const token = suggest.command ? `/${agentHandle(m.username)}` : `@${m.username}`;
    const next = `${text.slice(0, suggest.start)}${token} ${text.slice(caret)}`;
    setText(next);
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
    if (!files.length && !props.threadRoot && props.onAgentRequest?.(body)) {
      setText("");
      return;
    }
    clearTimeout(draftTimer.current); // before anything async: a pending draft save must not bring the text back
    const opts = { replyTo: props.replyTo?.id, threadRoot: props.threadRoot };
    // The box empties at once (the message shows as Sending), so whatever is typed while it encrypts and goes out
    // starts the next message instead of joining this one or being wiped when this one finishes.
    setText("");
    if (!props.threadRoot) void engine.saveDraft(c.id, "");
    try {
      if (files.length) {
        setBusy(hasPhotos && quality !== "original" ? "Preparing photos…" : null);
        // One at a time: decoding several large photos at once can run a phone's browser out of memory.
        const prepared: File[] = [];
        for (const f of files) prepared.push(await preparePhoto(f, quality));
        setBusy(null);
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
        await engine.sendText(c.id, body, customEmoji.length ? { ...opts, rich: { customEmoji } } : opts);
      }
      if (slowed && !props.threadRoot) setLastSent(Date.now());
      setFiles([]);
      props.onCancelReply();
      engine.setTyping(c.id, false);
    } catch (e) {
      // Not sent: the text comes back unless something new has been typed meanwhile.
      setText((now) => now || body);
      if (!(e instanceof UploadCancelled)) engine.notice("error", e instanceof Error ? e.message : "Couldn't send.");
    } finally {
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

  if (!c.canPost) {
    return (
      <div className="composer-wrap">
        <div className="composer-locked" role="note">
          <Lock size={16} />
          {c.archived
            ? "This channel is archived. You can read it, but nobody can post."
            : c.timedOutUntil && c.timedOutUntil > Date.now()
              ? `You're timed out in this community until ${untilWhen(c.timedOutUntil)}. You can read, but not post.`
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
      {suggest && (
        <div className="suggest card" role="listbox" aria-label={suggest.command ? "Agent commands" : "People and agents to mention"}>
          {suggest.items.map((m, i) => (
            <button key={m.id} role="option" aria-selected={i === suggest.index} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(m)}>
              {m.id === "everyone" ? (
                <AtSign size={18} />
              ) : m.id.startsWith(AGENT_PREFIX) ? (
                <Bot size={18} aria-hidden />
              ) : (
                <UserAvatar userId={m.id} name={m.displayName} colorIndex={m.avatarColor} photoRev={m.photoRev} size={24} decorative />
              )}
              <span className="grow ellipsis">{m.displayName}</span>
              <span className="faint">{m.id.startsWith(AGENT_PREFIX) ? (suggest.command ? `/${agentHandle(m.username)}` : "AI") : `@${m.username}`}</span>
            </button>
          ))}
        </div>
      )}
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
          <div className="composer-files" aria-label="Files to send">
            {files.map((f, i) => (
              <span key={`${f.name}-${i}`} className="file-chip">
                <Paperclip size={13} />
                <span className="ellipsis">{f.name}</span>
                <span className="faint">{bytes(f.size)}</span>
                <button className="icon-btn" style={{ width: 22, height: 22 }} onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`}>
                  <X size={12} />
                </button>
              </span>
            ))}
            {hasPhotos && (
              <label className="file-quality">
                <span>Photo quality</span>
                <select className="input input-sm" value={quality} onChange={(e) => setQuality(e.target.value as PhotoQuality)} disabled={!!busy}>
                  {(Object.keys(QUALITY_LABEL) as PhotoQuality[]).map((q) => (
                    <option key={q} value={q}>
                      {QUALITY_LABEL[q]}
                    </option>
                  ))}
                </select>
                <small className="faint">
                  {quality === "original"
                    ? "Sent as it is, with its details, including where it was taken if the photo records that."
                    : "Resized and re-saved here, so details such as location aren't sent."}
                </small>
              </label>
            )}
          </div>
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
              <button className="icon-btn composer-plus" onClick={(e) => attach.open(e.currentTarget)} aria-label={t("composer_add")} aria-haspopup="menu" title={t("composer_add")} disabled={!!busy}>
                <Plus size={19} />
              </button>
              <input
                ref={fileInput}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  addFiles(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />
              <textarea
                id={`composer-${c.id}-${props.threadRoot ?? "main"}`}
                ref={input}
                rows={1}
                value={text}
                placeholder={props.threadRoot ? t("composer_thread") : t("composer_message", { name: `${c.type === "CHANNEL" ? "#" : ""}${props.title}` })}
                onChange={(e) => onChange(e.target.value)}
                onBlur={() => engine.setTyping(c.id, false)}
                onPaste={(e: ClipboardEvent<HTMLTextAreaElement>) => {
                  const pasted = Array.from(e.clipboardData.files);
                  if (pasted.length) {
                    e.preventDefault();
                    addFiles(pasted);
                  }
                }}
                onKeyDown={(e) => {
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
              {PICKER_BUTTONS.filter((b) => b.tab === "emoji" || c.canPost).map((b) => (
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
                  onClick={() => void send()}
                  disabled={(!text.trim() && !files.length) || !!busy}
                  aria-label={t("composer_send")}
                  title={prefs.enterToSend ? "Send (Enter) · Shift+Enter for a new line" : "Send (Ctrl+Enter)"}
                >
                  <SendHorizontal size={17} />
                </button>
              )}
            </div>
            {busy && (
              <div className="composer-status" id={`composer-status-${c.id}`} aria-live="polite">
                <span className="grow">{busy}</span>
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
            { label: `Files (up to ${MAX_FILES_PER_MESSAGE})`, icon: <FileUp size={16} />, onSelect: () => fileInput.current?.click() },
            { label: "Poll…", icon: <BarChart3 size={16} />, onSelect: () => setRich("poll") },
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
          onEmoji={(em) => {
            emoji.close();
            insertAtCaret(em);
          }}
          community={
            communityEmoji
              ? {
                  list: communityEmoji,
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
                }
              : undefined
          }
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
