import { FileText } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useEngine, useOrbit } from "../../app/orbit";
import {
  type AiAnswer,
  type AiAsk,
  aiAsk,
  aiCatchUp,
  aiDocumentSummary,
  type AiDraft,
  type AiStatus,
  aiStatus,
  aiWorkflowDraft,
  aiWrite,
  type CatchUpMessage,
  REASON_TEXT,
  WRITE_LABEL,
  WRITE_MODES,
  type WriteMode,
} from "../../sync/ai";
import type { WfInput } from "../../sync/workflows";
import { Dialog } from "../components/Overlay";
import { useLoad } from "../workspace/useLoad";

const messageOf = (e: unknown) => (e instanceof Error ? e.message : "The AI request didn't go through.");

/** The workspace's AI status, or null while loading, outside a workspace, or on a server without AI. */
export function useAiStatus(orgId: string | null): AiStatus | null {
  const engine = useEngine();
  const offered = useOrbit((s) => s.server?.features.includes("ai") ?? false);
  return useLoad(() => (orgId && offered ? aiStatus(engine, orgId).catch(() => null) : Promise.resolve(null)), [engine, orgId, offered]).data ?? null;
}

interface FrameProps {
  title: string;
  status: AiStatus | null;
  canSend: boolean;
  onClose: () => void;
  /** Runs the request; this press is the person's consent for this one request. */
  send: () => Promise<AiAnswer | null>;
  onUse?: (text: string) => void;
  note?: string;
  children: ReactNode;
  after?: (answer: AiAnswer | null) => ReactNode;
}

/**
 * What every AI dialog shares (android AiFrame): why AI isn't available, the input, a note naming the provider and what
 * is sent, the Send button, then the answer marked as written by AI with Copy (and Use, when offered).
 */
function AiFrame({ title, status, canSend, onClose, send, onUse, note, children, after }: FrameProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<AiAnswer | null>(null);
  const [copied, setCopied] = useState(false);
  const provider = status?.provider;
  const reason = status?.reason ? (REASON_TEXT[status.reason] ?? REASON_TEXT.workspace_off) : null;
  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      setAnswer(await send());
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title={title} onClose={onClose}>
      <div className="dialog-body ai-dialog">
        {reason && (
          <div className="banner" role="status">
            {reason}
          </div>
        )}
        {children}
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        {!answer && status?.available && provider && (
          <>
            {note && <small className="faint">{note}</small>}
            <small className="faint">Meldiq sends only what's shown here to {provider.name}, keeps none of it, and the provider's own terms apply.</small>
            <button className="btn btn-primary" disabled={!canSend || busy} onClick={() => void go()}>
              {busy ? "Sending…" : `Send to ${provider.name}`}
            </button>
          </>
        )}
        {answer && (
          <>
            <div className="ai-answer" aria-live="polite">
              {answer.text}
            </div>
            <small className="faint">Written by AI ({answer.provider.name}). Check it before you use it.</small>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => void navigator.clipboard?.writeText(answer.text).then(() => setCopied(true))}>
                {copied ? "Copied" : "Copy"}
              </button>
              {onUse && (
                <button className="btn btn-primary btn-sm" onClick={() => onUse(answer.text)}>
                  Use this
                </button>
              )}
            </div>
          </>
        )}
        {after?.(answer)}
      </div>
    </Dialog>
  );
}

/** Writing help in the composer: the current draft, rewritten; "Use this" replaces the draft. */
export function AiWriteDialog({ orgId, draft, onUse, onClose }: { orgId: string; draft: string; onUse: (text: string) => void; onClose: () => void }) {
  const engine = useEngine();
  const status = useAiStatus(orgId);
  const [mode, setMode] = useState<WriteMode>("improve");
  return (
    <AiFrame title="Writing help" status={status} canSend={!!draft.trim()} onClose={onClose} onUse={onUse} send={() => aiWrite(engine, orgId, mode, draft.trim())}>
      {draft.trim() ? (
        <>
          <p className="ai-quote">{draft}</p>
          <span className="segmented" role="group" aria-label="How to rewrite it">
            {WRITE_MODES.map((m) => (
              <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>
                {WRITE_LABEL[m]}
              </button>
            ))}
          </span>
        </>
      ) : (
        <p className="faint">Type a message first, then ask for help with it.</p>
      )}
    </AiFrame>
  );
}

/** A channel catch-up: [messages] were picked, and decrypted, in this browser; only these are sent. */
export function AiCatchUpDialog({ orgId, channelId, messages, onClose }: { orgId: string; channelId: string; messages: CatchUpMessage[]; onClose: () => void }) {
  const engine = useEngine();
  const status = useAiStatus(orgId);
  return (
    <AiFrame title="Catch up" status={status} canSend={messages.length > 0} onClose={onClose} send={() => aiCatchUp(engine, orgId, channelId, messages)}>
      <p className="faint" style={{ margin: 0 }}>
        {messages.length === 0
          ? "There are no messages to catch up on yet."
          : `The last ${messages.length} ${messages.length === 1 ? "message" : "messages"} here. They're decrypted in this browser, and only these are sent.`}
      </p>
    </AiFrame>
  );
}

/** A document summary; documents are server-readable (docs/DOCUMENTS.md), and the dialog says so. */
export function AiDocSummaryDialog({ orgId, documentId, title, onClose }: { orgId: string; documentId: string; title: string; onClose: () => void }) {
  const engine = useEngine();
  const status = useAiStatus(orgId);
  return (
    <AiFrame
      title="Summarise with AI"
      status={status}
      canSend
      onClose={onClose}
      note={status?.provider ? `This document is server-readable. Its text is sent to ${status.provider.name}.` : undefined}
      send={() => aiDocumentSummary(engine, documentId)}
    >
      <strong>{title}</strong>
    </AiFrame>
  );
}

/** A question answered from the workspace documents the person can read, citing them as [1], [2]. */
export function AiAskDialog({ orgId, onOpenDocument, onClose }: { orgId: string; onOpenDocument: (id: string) => void; onClose: () => void }) {
  const engine = useEngine();
  const status = useAiStatus(orgId);
  const [question, setQuestion] = useState("");
  const [last, setLast] = useState<AiAsk | null>(null);
  const send = async () => {
    const r = await aiAsk(engine, orgId, question.trim());
    setLast(r);
    return r.text !== null && r.provider ? { text: r.text, provider: r.provider } : null;
  };
  return (
    <AiFrame
      title="Ask your documents"
      status={status}
      canSend={question.trim().length >= 3}
      onClose={onClose}
      note="Meldiq finds documents you can read that match, then sends the question and those documents."
      send={send}
      after={(answer) => (
        <>
          {last && !last.found && <p className="faint">No documents you can read match that question, so nothing was sent.</p>}
          {answer && last && last.sources.length > 0 && (
            <div className="field">
              <span>Sources</span>
              <ul className="ws-list">
                {last.sources.map((s) => (
                  <li key={s.id}>
                    <button className="list-row" onClick={() => onOpenDocument(s.id)}>
                      <FileText size={15} className="faint" /> [{s.n}] {s.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    >
      <textarea className="input" rows={2} maxLength={500} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Your question" aria-label="Your question" autoFocus />
    </AiFrame>
  );
}

/** A workflow drafted from a description; "Open in the editor" hands it over, switched off and unsaved. */
export function AiWorkflowDraftDialog({ orgId, onOpen, onClose }: { orgId: string; onOpen: (draft: WfInput) => void; onClose: () => void }) {
  const engine = useEngine();
  const status = useAiStatus(orgId);
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<AiDraft | null>(null);
  const send = async () => {
    const r = await aiWorkflowDraft(engine, orgId, description.trim(), Intl.DateTimeFormat().resolvedOptions().timeZone);
    setResult(r);
    return { text: r.draft?.name ?? r.problems.join(". "), provider: r.provider };
  };
  return (
    <AiFrame
      title="Draft a workflow with AI"
      status={status}
      canSend={description.trim().length >= 5}
      onClose={onClose}
      note="Drafts start switched off and are never saved until you save them."
      send={send}
      after={(answer) =>
        answer &&
        result?.draft && (
          <>
            {result.problems.length > 0 && (
              <div className="banner warn" role="status">
                Fix before saving: {result.problems.join(". ")}
              </div>
            )}
            <button className="btn btn-primary" onClick={() => onOpen(result.draft!)}>
              Open in the editor
            </button>
          </>
        )
      }
    >
      <textarea
        className="input"
        rows={3}
        maxLength={1000}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="For example: when someone joins, welcome them in #general"
        aria-label="What should happen?"
        autoFocus
      />
    </AiFrame>
  );
}
