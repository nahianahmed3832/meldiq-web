import { AtSign, Lock, Paperclip, SendHorizontal, Smile, X } from "lucide-react";
import { type ClipboardEvent, type DragEvent, useCallback, useEffect, useRef, useState } from "react";
import type { Conversation, Member } from "../../api/schemas";
import { useEngine } from "../../app/orbit";
import { usePrefs } from "../../app/prefs";
import type { StoredMessage } from "../../model/types";
import { MAX_FILES_PER_MESSAGE, MAX_UPLOAD_BYTES, sendFiles } from "../../sync/attachments";
import { activeMentionQuery } from "../../sync/mentions";
import { Avatar } from "../components/Avatar";
import { Menu, useMenu } from "../components/Overlay";
import { bytes } from "../format";
import { EMOJI } from "./MessageItem";

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
  const [busy, setBusy] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [suggest, setSuggest] = useState<{ start: number; items: Member[]; index: number } | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const emoji = useMenu();
  const draftTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

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
      const tooBig = list.find((f) => f.size > MAX_UPLOAD_BYTES - 16);
      if (tooBig) engine.notice("error", `"${tooBig.name}" is larger than 25 MB. Send larger files from your phone.`);
      setFiles((cur) => [...cur, ...list.filter((f) => f.size <= MAX_UPLOAD_BYTES - 16 && f.size > 0)].slice(0, MAX_FILES_PER_MESSAGE));
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
    try {
      if (files.length) {
        setBusy(`Encrypting and uploading ${files.length === 1 ? "1 file" : `${files.length} files`}…`);
        await sendFiles(
          engine,
          c.id,
          files.map((f) => ({ name: f.name, type: f.type, size: f.size, bytes: async () => new Uint8Array(await f.arrayBuffer()) })),
          body,
          opts,
          (done, total) => setBusy(`Uploading ${done} of ${total}…`),
        );
      } else await engine.sendText(c.id, body, opts);
      setText("");
      setFiles([]);
      props.onCancelReply();
      engine.setTyping(c.id, false);
      if (!props.threadRoot) void engine.saveDraft(c.id, "");
    } catch (e) {
      engine.notice("error", e instanceof Error ? e.message : "Couldn't send.");
    } finally {
      setBusy(null);
      input.current?.focus();
    }
  };

  if (!c.canPost) {
    return (
      <div className="composer-wrap">
        <div className="composer-locked" role="note">
          <Lock size={16} />
          {c.archived
            ? "This channel is archived. You can read it, but nobody can post."
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
          </div>
        )}
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
          <button className="icon-btn" onClick={() => fileInput.current?.click()} aria-label="Attach files" title={`Attach files (up to ${MAX_FILES_PER_MESSAGE}, 25 MB each)`} disabled={!!busy}>
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
          <button className="send-btn" onClick={() => void send()} disabled={(!text.trim() && !files.length) || !!busy} aria-label="Send">
            <SendHorizontal size={17} />
          </button>
        </div>
      </div>
      {emoji.anchor && (
        <Menu
          anchor={emoji.anchor}
          label="Emoji"
          onClose={emoji.close}
          entries={[
            {
              custom: (
                <div className="emoji-grid">
                  {EMOJI.map((em) => (
                    <button
                      key={em}
                      role="menuitem"
                      aria-label={em}
                      onClick={() => {
                        emoji.close();
                        onChange(text + em);
                        input.current?.focus();
                      }}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              ),
            },
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
