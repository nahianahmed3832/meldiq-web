import { ArrowLeft, Paperclip, Sparkles, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useEngine, useOrbit } from "../../../app/orbit";
import { navigate } from "../../../app/router";
import {
  addInboxNote,
  CLOSED_TEXT,
  composerState,
  customerLabel,
  DELIVERY_LABEL,
  fits,
  hoursLeft,
  inboxAiDraft,
  inboxAiSummary,
  inboxAttachment,
  type InboxConversation,
  inboxConversation,
  type InboxDetail,
  type InboxMessage,
  inboxSettings,
  markInboxRead,
  providerBadge,
  sendInboxReply,
  STATUS_LABEL,
} from "../../../sync/inbox";
import { useAiStatus } from "../../ai/AiDialogs";
import { Dialog } from "../../components/Overlay";
import { shortWhen } from "../../format";
import { useAction, useLoad } from "../useLoad";
import { ErrorLine } from "../WorkspaceView";
import { InboxActionsDialog, InboxTemplateDialog } from "./InboxDialogs";
import { NotE2eeNote } from "./InboxPage";

const back = () => navigate({ section: "workspace", workspacePage: "inbox" });

/**
 * One customer conversation (android round 8 InboxConversationScreen). The composer offers only what the platform
 * allows now: a free reply inside its window, an approved template on WhatsApp after it, nothing when it's closed.
 * Notes stay inside the team. AI drafts are labelled until the person sends them.
 */
export function InboxConversationScreen({ conversationId }: { conversationId: string }) {
  const engine = useEngine();
  const rev = useOrbit((s) => s.inboxRev);
  const [tick, setTick] = useState(0);
  const loaded = useLoad(() => inboxConversation(engine, conversationId), [engine, conversationId, rev, tick]);
  const d = loaded.data;
  const orgId = d?.conversation.orgId || null;
  const ai = useAiStatus(orgId);
  const aiMode = useLoad(() => (orgId ? inboxSettings(engine, orgId).then((s) => s.settings.aiMode) : Promise.resolve("off")), [engine, orgId]).data ?? "off";
  const aiOn = !!ai?.available && aiMode !== "off";
  const [dialog, setDialog] = useState<"actions" | "template" | "summary" | null>(null);
  const reload = () => setTick((t) => t + 1);

  useEffect(() => {
    if (d && d.conversation.unread > 0) void markInboxRead(engine, d.conversation.id).catch(() => undefined);
  }, [engine, d]);

  if (!d)
    return (
      <div className="ws-page">
        <button className="btn btn-ghost btn-sm" style={{ justifySelf: "start" }} onClick={back}>
          <ArrowLeft size={14} /> Customer inbox
        </button>
        {loaded.error ? <ErrorLine text={loaded.error} /> : <div className="skeleton" style={{ height: 240 }} aria-busy="true" />}
      </div>
    );

  const c = d.conversation;
  return (
    <div className="ws-page ib-conversation">
      <div className="row doc-toolbar">
        <button className="btn btn-ghost btn-sm" onClick={back}>
          <ArrowLeft size={14} /> Customer inbox
        </button>
        <span className="lines grow">
          <strong>{customerLabel(c)}</strong>
          <small className="faint">
            {providerBadge(c.provider)} · {c.account.name} · {STATUS_LABEL[c.status] ?? c.status}
          </small>
        </span>
        {aiOn && (
          <button className="btn btn-ghost btn-sm" onClick={() => setDialog("summary")}>
            <Sparkles size={14} /> Summarise with AI
          </button>
        )}
        <button className="btn btn-secondary btn-sm" onClick={() => setDialog("actions")}>
          <SlidersHorizontal size={14} /> Conversation
        </button>
      </div>
      {c.handling === "escalated" && (
        <div className="banner warn" role="status">
          Needs a person: {c.escalationReason ?? "?"}
        </div>
      )}
      <Thread messages={d.messages} />
      <Composer d={d} aiOn={aiOn} onSent={reload} onTemplate={() => setDialog("template")} />
      {dialog === "actions" && (
        <InboxActionsDialog
          conversation={c}
          onClose={() => setDialog(null)}
          onChanged={() => {
            setDialog(null);
            reload();
          }}
          onErased={back}
        />
      )}
      {dialog === "template" && (
        <InboxTemplateDialog
          conversation={c}
          onClose={() => setDialog(null)}
          onSent={() => {
            setDialog(null);
            reload();
          }}
        />
      )}
      {dialog === "summary" && (
        <InboxAiDialog title="Summarise with AI" conversation={c} provider={ai?.provider?.name ?? null} run={() => inboxAiSummary(engine, c.id)} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

function Thread({ messages }: { messages: InboxMessage[] }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [messages.length]);
  return (
    <div className="card ib-thread" ref={box} aria-label="Messages">
      <NotE2eeNote />
      {messages.map((m) => (
        <MessageItem key={m.id} m={m} />
      ))}
    </div>
  );
}

function MessageItem({ m }: { m: InboxMessage }) {
  const engine = useEngine();
  const [error, setError] = useState<string | null>(null);
  const out = m.direction === "out";
  const note = m.direction === "note";
  // Files are always saved, never opened in this page: what a customer sends could be anything.
  const download = async (n: number, type: string) => {
    setError(null);
    try {
      const bytes = await inboxAttachment(engine, m.id, n);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/octet-stream" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `customer-${type}-${m.id}-${n}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The file isn't available.");
    }
  };
  return (
    <div className={`ib-msg ${note ? "note" : out ? "out" : "in"}`}>
      {note && <small className="ib-label warn-text">Internal note</small>}
      {m.origin === "ai_auto" && <small className="ib-label ai-text">Automatic reply</small>}
      {m.origin === "ai_draft" && <small className="ib-label ai-text">Sent from an AI draft</small>}
      {m.text && <p>{m.text}</p>}
      {m.attachments.map((a) => (
        <button key={a.n} className="btn btn-ghost btn-sm" style={{ justifySelf: "start" }} onClick={() => void download(a.n, a.type)}>
          <Paperclip size={13} /> Attachment: {a.type} · Download
        </button>
      ))}
      {error && <small className="danger-text">{error}</small>}
      <small className={m.status === "failed" ? "danger-text" : "faint"}>
        {shortWhen(m.at)}
        {out ? ` · ${m.status === "failed" ? `Not delivered (${m.errorKind ?? "?"})` : (DELIVERY_LABEL[m.status] ?? "Sent")}` : ""}
      </small>
    </div>
  );
}

function Composer({ d, aiOn, onSent, onTemplate }: { d: InboxDetail; aiOn: boolean; onSent: () => void; onTemplate: () => void }) {
  const engine = useEngine();
  const ai = useAiStatus(d.conversation.orgId || null);
  const [text, setText] = useState("");
  const [noteMode, setNoteMode] = useState(false);
  const [fromDraft, setFromDraft] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const act = useAction();
  const state = composerState(d);
  const replyOk = state.kind === "text";
  const ok = noteMode || fits(d.conversation.provider, text, d.reply.textLimit);
  const hint =
    state.kind === "text"
      ? d.reply.rule.mode === "human_agent_tag"
        ? "Past 24 hours: a person may still reply (Human Agent)"
        : (() => {
            const h = hoursLeft(d.reply.windowEndsAt, Date.now());
            return h ? `Free replies for ${h} more ${h === 1 ? "hour" : "hours"}` : null;
          })()
      : state.kind === "template_only"
        ? CLOSED_TEXT.template_required
        : state.kind === "closed"
          ? (CLOSED_TEXT[state.reason] ?? CLOSED_TEXT.unsupported)
          : "You can read and add notes, but not reply to customers.";
  const send = () =>
    void act.act(async () => {
      const body = text.trim();
      if (!body) return;
      await (noteMode ? addInboxNote(engine, d.conversation.id, body) : sendInboxReply(engine, d.conversation.id, body, fromDraft));
      setText("");
      setFromDraft(false);
      onSent();
    });
  return (
    <div className="card ib-composer">
      <div className="chips search-filters" role="group" aria-label="Compose">
        <button className="chip" aria-selected={!noteMode} onClick={() => setNoteMode(false)}>
          Reply
        </button>
        <button className="chip" aria-selected={noteMode} onClick={() => setNoteMode(true)}>
          Note
        </button>
        {aiOn && replyOk && !noteMode && (
          <button className="chip" onClick={() => setDrafting(true)}>
            <Sparkles size={12} /> Draft a reply with AI
          </button>
        )}
        {d.reply.templates && d.reply.canReply && !noteMode && (
          <button className="chip" onClick={onTemplate}>
            Send a template
          </button>
        )}
      </div>
      {!noteMode && hint && <small className={replyOk ? "faint" : "warn-text"}>{hint}</small>}
      {fromDraft && !noteMode && <small className="ai-text">AI draft: review before sending</small>}
      {(noteMode || replyOk) && (
        <div className="row ib-compose-row">
          <textarea
            className="input grow"
            rows={2}
            maxLength={4096}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (!e.target.value) setFromDraft(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
            }}
            placeholder={noteMode ? "Only your team sees notes" : "Reply to the customer"}
            aria-label={noteMode ? "Internal note" : "Reply"}
            aria-invalid={!ok}
          />
          <button className={`btn ${noteMode ? "btn-secondary" : "btn-primary"}`} disabled={!text.trim() || !ok || act.busy} onClick={send}>
            {act.busy ? "Sending…" : noteMode ? "Add note" : "Send"}
          </button>
        </div>
      )}
      {!ok && (
        <small className="danger-text">
          Too long for {providerBadge(d.conversation.provider)}: at most {d.reply.textLimit}.
        </small>
      )}
      <ErrorLine text={act.error} />
      {drafting && (
        <InboxAiDialog
          title="Draft a reply with AI"
          conversation={d.conversation}
          provider={ai?.provider?.name ?? null}
          run={() => inboxAiDraft(engine, d.conversation.id)}
          onClose={() => setDrafting(false)}
          onUse={(draft) => {
            setText(draft);
            setFromDraft(true);
            setNoteMode(false);
            setDrafting(false);
          }}
        />
      )}
    </div>
  );
}

/** AI on a conversation: names who receives it (never the notes) and sends only on the person's press. */
function InboxAiDialog({
  title,
  conversation,
  provider,
  run,
  onClose,
  onUse,
}: {
  title: string;
  conversation: InboxConversation;
  provider: string | null;
  run: () => Promise<{ text: string; provider: { name: string } }>;
  onClose: () => void;
  onUse?: (text: string) => void;
}) {
  const act = useAction();
  const [answer, setAnswer] = useState<{ text: string; provider: { name: string } } | null>(null);
  return (
    <Dialog title={title} onClose={onClose}>
      <div className="dialog-body ai-dialog">
        <small className="faint">{customerLabel(conversation)}</small>
        {!answer && provider && (
          <>
            <small className="faint">The conversation (not your notes) is sent to {provider}. Meldiq keeps none of it.</small>
            <button
              className="btn btn-primary"
              disabled={act.busy}
              onClick={() =>
                void act.act(async () => {
                  const r = await run();
                  if (onUse) onUse(r.text);
                  else setAnswer(r);
                })
              }
            >
              {act.busy ? "Sending…" : `Send to ${provider}`}
            </button>
          </>
        )}
        {answer && (
          <>
            <div className="ai-answer">{answer.text}</div>
            <small className="faint">Written by AI ({answer.provider.name}). Check it before you use it.</small>
          </>
        )}
        <ErrorLine text={act.error} />
      </div>
    </Dialog>
  );
}
