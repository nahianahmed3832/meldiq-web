import { AtSign, BarChart3, FileUp, Lock, MapPin, Mic, Paperclip, ScrollText, SendHorizontal, Smile, Sparkles, UserRound, X } from "lucide-react";
import { type ClipboardEvent, type DragEvent, useCallback, useEffect, useRef, useState } from "react";
import type { Conversation, Member } from "../../api/schemas";
import { useEngine } from "../../app/orbit";
import { usePrefs } from "../../app/prefs";
import type { StoredMessage } from "../../model/types";
import type { RichContent } from "../../model/types";
import { fileLimit, MAX_FILES_PER_MESSAGE, sendFiles } from "../../sync/attachments";
import { type PhotoQuality, preparePhoto, QUALITY_LABEL, reencodable } from "../../sync/photoQuality";
import { UploadCancelled } from "../../sync/largeUpload";
import { fallbackText } from "../../sync/rich";
import { type Recording, voiceFileName, voiceMime } from "../../sync/voice";
import { activeMentionQuery } from "../../sync/mentions";
import { Avatar } from "../components/Avatar";
import { Menu, useMenu } from "../components/Overlay";
import { bytes } from "../format";
import { EmojiPicker } from "./EmojiPicker";
import { ANIMOJI } from "../../sync/animoji";
import { STICKER_PACKS } from "../../sync/stickers";
import { PollDialog } from "./PollDialog";
import { StickerArt } from "./StickerView";
import { LocationDialog } from "./RichDialogs";
import { ProfileShareDialog } from "./ProfileCards";
import { VoiceBar } from "./VoiceBar";
import { AiCatchUpDialog, AiWriteDialog, useAiStatus } from "../ai/AiDialogs";
import { catchUpMessages } from "../../sync/ai";
import { slowmodeLabel, waitText } from "../../sync/communityRules";
import { untilWhen } from "../format";
import { useNow } from "../call/useNow";

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
  const prefs = usePrefs();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [quality, setQuality] = useState<PhotoQuality>("standard");
  const hasPhotos = files.some((f) => reencodable(f.type));
  const [busy, setBusy] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [suggest, setSuggest] = useState<{ start: number; items: Member[]; index: number } | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const emoji = useMenu();
  const attach = useMenu();
  const upload = useRef<AbortController | null>(null);
  const [voice, setVoice] = useState(false);
  const [rich, setRich] = useState<"contact" | "location" | "poll" | null>(null);
  const [aiDialog, setAiDialog] = useState<"write" | "catch-up" | null>(null);
  // Workspace AI (android round 7 C8): offered only when the server says it can be used here; nothing is sent unasked.
  const ai = useAiStatus(c.orgId ?? null);
  const canRecord = !props.threadRoot && voiceMime() !== null;
  const draftTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
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
    const q = c.type === "DM" ? null : activeMentionQuery(value, caret);
    if (!q) return setSuggest(null);
    const pool = [...members.filter((m) => m.id !== engine.device.userId)];
    const items = [
      ...(c.canMentionAll && "everyone".startsWith(q.query) ? [{ id: "everyone", username: "everyone", displayName: "Everyone in this conversation", avatarColor: 7 } as Member] : []),
      ...pool.filter((m) => m.username.toLowerCase().startsWith(q.query) || m.displayName.toLowerCase().includes(q.query)),
    ].slice(0, 8);
    setSuggest(items.length ? { start: q.start, items, index: 0 } : null);
  };

  const pick = (m: Member) => {
    if (!suggest) return;
    const caret = input.current?.selectionStart ?? text.length;
    const next = `${text.slice(0, suggest.start)}@${m.username} ${text.slice(caret)}`;
    setText(next);
    setSuggest(null);
    requestAnimationFrame(() => {
      const pos = suggest.start + m.username.length + 2;
      input.current?.setSelectionRange(pos, pos);
      input.current?.focus();
    });
  };

  const send = async () => {
    const body = text.trim();
    if ((!body && !files.length) || busy) return;
    clearTimeout(draftTimer.current); // before anything async: a pending draft save must not bring the text back
    const opts = { replyTo: props.replyTo?.id, threadRoot: props.threadRoot };
    // The box empties at once (the message shows as Sending), so whatever is typed while it encrypts and goes out
    // starts the next message instead of joining this one or being wiped when this one finishes.
    setText("");
    if (!props.threadRoot) void engine.saveDraft(c.id, "");
    try {
      if (files.length) {
        setBusy(hasPhotos && quality !== "original" ? "Preparing photos…" : `Encrypting and uploading ${files.length === 1 ? "1 file" : `${files.length} files`}…`);
        // One at a time: decoding several large photos at once can run a phone's browser out of memory.
        const prepared: File[] = [];
        for (const f of files) prepared.push(await preparePhoto(f, quality));
        await sendFiles(
          engine,
          c.id,
          prepared.map((f) => ({ name: f.name, type: f.type, size: f.size, bytes: async () => new Uint8Array(await f.arrayBuffer()), source: f })),
          body,
          opts,
          (done, total) => setBusy(`Uploading ${done} of ${total}…`),
          {
            signal: (upload.current = new AbortController()).signal,
            onProgress: (name, p) => setBusy(`${p.phase === "hashing" ? "Encrypting" : "Uploading"} ${name}… ${Math.floor((100 * p.done) / Math.max(1, p.total))}%`),
          },
        );
      } else await engine.sendText(c.id, body, opts);
      if (slowed && !props.threadRoot) setLastSent(Date.now());
      setFiles([]);
      props.onCancelReply();
      engine.setTyping(c.id, false);
    } catch (e) {
      // Not sent: the text comes back unless something new has been typed meanwhile.
      setText((now) => now || body);
      if (!(e instanceof UploadCancelled)) engine.notice("error", e instanceof Error ? e.message : "Couldn't send.");
    } finally {
      upload.current = null;
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
      {suggest && (
        <div className="suggest card" role="listbox" aria-label="People to mention">
          {suggest.items.map((m, i) => (
            <button key={m.id} role="option" aria-selected={i === suggest.index} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(m)}>
              {m.id === "everyone" ? <AtSign size={18} /> : <Avatar name={m.displayName} colorIndex={m.avatarColor} size={24} decorative />}
              <span className="grow ellipsis">{m.displayName}</span>
              <span className="faint">@{m.username}</span>
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
              Replying to <b>{props.replyName}</b>: {props.replyTo.text || "attachment"}
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
            <textarea
              id={`composer-${c.id}-${props.threadRoot ?? "main"}`}
              ref={input}
              rows={1}
              value={text}
              placeholder={props.threadRoot ? "Reply in thread…" : `Message ${c.type === "CHANNEL" ? "#" : ""}${props.title}`}
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
            <div className="composer-tools">
              <button className="icon-btn" onClick={(e) => attach.open(e.currentTarget)} aria-label="Attach" aria-haspopup="menu" title="Attach files, a contact or your location" disabled={!!busy}>
                <Paperclip size={18} />
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
              <button className="icon-btn" onClick={(e) => emoji.open(e.currentTarget)} aria-label="Insert emoji" aria-haspopup="menu">
                <Smile size={18} />
              </button>
              {c.type !== "DM" && (
                <button
                  className="icon-btn"
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
              <span className="hint" id={`composer-status-${c.id}`} aria-live="polite">
                {busy ?? (prefs.enterToSend ? "Enter to send · Shift+Enter for a new line" : "Ctrl+Enter to send")}
              </span>
              {busy && upload.current && (
                <button className="btn btn-ghost btn-sm" onClick={() => upload.current?.abort()}>
                  Cancel
                </button>
              )}
              {canRecord && !text.trim() && !files.length && !busy ? (
                <button className="send-btn" onClick={() => setVoice(true)} aria-label="Record a voice message">
                  <Mic size={17} />
                </button>
              ) : (
                <button className="send-btn" onClick={() => void send()} disabled={(!text.trim() && !files.length) || !!busy} aria-label="Send">
                  <SendHorizontal size={17} />
                </button>
              )}
            </div>
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
            ...(ai?.available && c.orgId
              ? [
                  { label: "Writing help (AI)…", icon: <Sparkles size={16} />, onSelect: () => setAiDialog("write") },
                  ...(c.type === "CHANNEL" && !props.threadRoot ? [{ label: "Catch up (AI)…", icon: <ScrollText size={16} />, onSelect: () => setAiDialog("catch-up") }] : []),
                ]
              : []),
          ]}
        />
      )}
      {rich === "contact" && <ProfileShareDialog onClose={() => setRich(null)} onSend={(contact) => void sendRich({ contact })} />}
      {rich === "location" && <LocationDialog onClose={() => setRich(null)} onSend={(location) => void sendRich({ location })} />}
      {aiDialog === "write" && c.orgId && (
        <AiWriteDialog
          orgId={c.orgId}
          draft={text}
          onClose={() => setAiDialog(null)}
          onUse={(t) => {
            setAiDialog(null);
            onChange(t);
            input.current?.focus();
          }}
        />
      )}
      {aiDialog === "catch-up" && c.orgId && (
        <AiCatchUpDialog
          orgId={c.orgId}
          channelId={c.id}
          messages={catchUpMessages(engine.state.get().messages[c.id]?.items ?? [], (id) => engine.state.get().users[id]?.displayName ?? "?")}
          onClose={() => setAiDialog(null)}
        />
      )}
      {rich === "poll" && <PollDialog onClose={() => setRich(null)} onSend={(poll) => void sendRich({ poll })} />}
      {emoji.anchor && (
        <Menu
          anchor={emoji.anchor}
          label="Emoji"
          onClose={emoji.close}
          entries={[
            {
              custom: (
                <EmojiPicker
                  onPick={(em) => {
                    emoji.close();
                    onChange(text + em);
                    input.current?.focus();
                  }}
                />
              ),
            },
            ...(props.conversation.canPost
              ? [
                  { heading: "Stickers" },
                  {
                    custom: (
                      <div className="sticker-picker">
                        {STICKER_PACKS.flatMap((pack) =>
                          pack.stickers.map((s) => (
                            <button
                              key={`${pack.id}/${s.id}`}
                              role="menuitem"
                              aria-label={`Send sticker: ${s.caption}`}
                              title={s.caption}
                              onClick={() => {
                                emoji.close();
                                void sendRich({ sticker: { pack: pack.id, id: s.id } });
                              }}
                            >
                              <StickerArt spec={s} size={60} still />
                            </button>
                          )),
                        )}
                      </div>
                    ),
                  },
                  { heading: "Send animated" },
                  {
                    custom: (
                      <div className="emoji-grid">
                        {ANIMOJI.map(([em]) => (
                          <button
                            key={em}
                            role="menuitem"
                            aria-label={`Send animated ${em}`}
                            onClick={() => {
                              emoji.close();
                              void sendRich({ animoji: em });
                            }}
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                    ),
                  },
                ]
              : []),
          ]}
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
