import { Paperclip, Send, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useEngine } from "../../application/orbit";
import { messagesToShare, SHARE_CHOICES } from "../../sync/agentRules";
import { AI_NOTICE, agentDetail, createJob, guessType, type JobDetail, uploadAgentFile } from "../../sync/aiWorkforce";
import { Dialog } from "../components/Overlay";
import { useAction, useLoad } from "../workspace/useLoad";
import { SkillFields } from "./AgentBits";

export interface AskableAgent {
  id: string;
  displayName: string;
  canInvoke?: boolean;
}

/**
 * Asking an agent for work (server docs/AI_WORKFORCE.md §2): the brief, the agent's own options, files, and the
 * notice that all of it leaves end-to-end encryption. Nothing is sent before Send. From a channel, the request and
 * the agent's answers show there for the channel's members, and the person may share the channel's recent messages:
 * decrypted in this browser, as it shows them when the dialog opens, and only when they choose a number.
 */
export function AskAgentDialog({
  orgId,
  agents,
  initialAgent,
  initialBrief = "",
  conversationId = null,
  threadRoot = null,
  onClose,
  onSent,
}: {
  orgId: string;
  agents: AskableAgent[];
  initialAgent?: string | null;
  initialBrief?: string;
  conversationId?: string | null;
  threadRoot?: string | null;
  onClose: () => void;
  onSent: (job: JobDetail) => void;
}) {
  const engine = useEngine();
  const usable = agents.filter((a) => a.canInvoke !== false);
  const [installId, setInstallId] = useState(initialAgent && usable.some((a) => a.id === initialAgent) ? initialAgent : (usable[0]?.id ?? ""));
  const [brief, setBrief] = useState(initialBrief);
  const [options, setOptions] = useState<Record<string, unknown>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [shareCount, setShareCount] = useState(0);
  // What this browser has decrypted when the dialog opens: what the person sees is what would be sent.
  const recent = useMemo(() => {
    if (!conversationId) return [];
    const s = engine.state.get();
    return messagesToShare(s.messages[conversationId]?.items ?? [], (id) => s.users[id]?.displayName ?? "?", SHARE_CHOICES[SHARE_CHOICES.length - 1]);
  }, [engine, conversationId]);
  const picker = useRef<HTMLInputElement>(null);
  const detail = useLoad(() => (installId ? agentDetail(engine, orgId, installId) : Promise.resolve(null)), [engine, orgId, installId]);
  const act = useAction();
  useEffect(() => {
    setOptions({});
    setShareCount(0);
  }, [installId]);
  const def = detail.data?.definition ?? null;
  const canShare = !!conversationId && !!def?.skill.readsMessages && recent.length > 0;
  const shared = canShare ? recent.slice(-shareCount) : [];
  const shareOptions = SHARE_CHOICES.filter((_, i) => i === 0 || SHARE_CHOICES[i - 1]! < recent.length);
  const limits = def?.skill.files;
  const typeOk = (f: File) => !limits || limits.types.includes(f.type || guessType(f.name));
  const fileProblem =
    limits && files.length > limits.max
      ? `${detail.data?.agent.displayName} takes at most ${limits.max} files.`
      : limits && files.length < limits.min
        ? `${detail.data?.agent.displayName} needs ${limits.min === 1 ? "a file" : `${limits.min} files`} (${limits.types.slice(0, 4).join(", ")}).`
        : files.find((f) => !typeOk(f))
          ? `${files.find((f) => !typeOk(f))!.name} isn't a kind of file this agent reads.`
          : files.find((f) => limits && f.size > limits.maxBytes)
            ? `${files.find((f) => limits && f.size > limits.maxBytes)!.name} is too large for this agent.`
            : null;
  const blocked = agents.find((a) => a.id === initialAgent && a.canInvoke === false);
  const send = () =>
    void act
      .act(async () => {
        const ids: string[] = [];
        for (const [i, f] of files.entries()) {
          setProgress(`Uploading ${f.name} (${i + 1} of ${files.length})…`);
          ids.push((await uploadAgentFile(engine, orgId, f)).id);
        }
        setProgress("Sending…");
        const clean = Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined));
        const job = await createJob(engine, orgId, {
          installId,
          input: { ...clean, brief: brief.trim() },
          conversationId,
          threadRoot,
          fileIds: ids,
          requestText: conversationId ? brief.trim() : null,
          channelMessages: shared.length && shareCount ? shared : null,
        });
        setProgress(null);
        onSent(job);
      })
      .finally(() => setProgress(null));
  return (
    <Dialog
      title="Ask an AI agent"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={act.busy || !installId || !brief.trim() || !!fileProblem} onClick={send}>
            <Send size={15} /> {act.busy ? (progress ?? "Sending…") : "Send to the agent"}
          </button>
        </>
      }
    >
      <div className="dialog-body">
        {blocked && <div className="banner danger">You can't ask {blocked.displayName}: its community limits it to some roles, or your roles don't allow AI agents.</div>}
        {usable.length === 0 ? (
          <p className="muted">No agent here can take a request from you.</p>
        ) : (
          <>
            <label className="field">
              <span>Agent</span>
              <select value={installId} onChange={(e) => setInstallId(e.target.value)}>
                {usable.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.displayName}
                  </option>
                ))}
              </select>
            </label>
            {def && (
              <p className="faint" style={{ margin: 0 }}>
                {def.description}
              </p>
            )}
            {detail.data?.setup && !detail.data.setup.ready && <div className="banner warn">This agent may not be able to finish: {detail.data.setup.missing.join(" ")}</div>}
            <label className="field">
              <span>What should it do?</span>
              <textarea rows={5} value={brief} maxLength={8000} onChange={(e) => setBrief(e.target.value)} placeholder={def?.examples[0] ?? "Describe the task"} autoFocus />
            </label>
            {def && <SkillFields schema={def.skill.inputSchema} value={options} onChange={setOptions} />}
            <div className="field">
              <span>
                Files{" "}
                {limits ? (
                  <small className="faint">
                    ({limits.min ? `at least ${limits.min}, ` : ""}up to {limits.max})
                  </small>
                ) : null}
              </span>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                {files.map((f) => (
                  <span key={`${f.name}-${f.size}`} className="chip">
                    {f.name}
                    <button className="icon-btn" aria-label={`Remove ${f.name}`} onClick={() => setFiles((cur) => cur.filter((x) => x !== f))}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <button className="btn btn-sm btn-secondary" onClick={() => picker.current?.click()}>
                  <Paperclip size={14} /> Add files
                </button>
                <input ref={picker} type="file" multiple hidden accept={limits?.types.join(",")} onChange={(e) => setFiles((cur) => [...cur, ...Array.from(e.target.files ?? [])])} />
              </div>
              {fileProblem && <small className="danger-text">{fileProblem}</small>}
            </div>
            {canShare && (
              <label className="field">
                <span>Share recent messages from this channel</span>
                <select value={shareCount} onChange={(e) => setShareCount(Number(e.target.value))}>
                  <option value={0}>Don't share messages</option>
                  {shareOptions.map((n) => (
                    <option key={n} value={n}>
                      {n < recent.length ? `The last ${n} messages` : recent.length === 1 ? "The one recent message" : `All ${recent.length} recent messages`}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="banner warn">
              {AI_NOTICE}{" "}
              {shareCount && shared.length
                ? `${shared.length === 1 ? "The last message here, as this browser shows it, is" : `The last ${shared.length} messages here, as this browser shows them, are`} sent with your request, whoever wrote ${shared.length === 1 ? "it" : "them"}. Everyone in the channel is told.`
                : "Only what you put here is sent, never the channel's messages."}
            </div>
          </>
        )}
        {act.error && <div className="banner danger">{act.error}</div>}
      </div>
    </Dialog>
  );
}
