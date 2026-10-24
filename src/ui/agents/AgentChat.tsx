import { type ReactNode, useMemo, useState } from "react";
import { ApiError } from "../../api/client";
import { useEngine, useOrbit } from "../../application/orbit";
import { agentInvocation } from "../../sync/agentRules";
import { AI_NOTICE, type AgentPost, type ChannelAgent, channelPosts, createJob } from "../../sync/aiWorkforce";
import { UserAvatar } from "../components/OrgAvatar";
import { Dialog } from "../components/Overlay";
import type { TimelineExtra } from "../chat/MessageList";
import { clock, fullTime } from "../format";
import { useLoad } from "../workspace/useLoad";
import { AgentAvatar, AgentFileView } from "./AgentBits";
import { ChannelAsk } from "./AgentsBar";
import { JobView } from "./JobView";

/**
 * AI agents in a channel's chat, like bots (server docs/AI_WORKFORCE.md §2): "@Agent …" sends the request at once (the
 * not-end-to-end-encrypted notice is asked once per browser), and the request and the agent's answers appear among the
 * messages. They are server-stored posts, never encrypted messages, and each is marked so.
 */
const NOTICE_KEY = "meldiq.agents.noticeSeen";

function noticeSeen(): boolean {
  try {
    return localStorage.getItem(NOTICE_KEY) === "1";
  } catch {
    return false;
  }
}
function rememberNotice(): void {
  try {
    localStorage.setItem(NOTICE_KEY, "1");
  } catch {
    // Private window or blocked storage: the notice is simply asked again next time.
  }
}

/** The channel's agent posts, oldest first (the newest 100); reloaded on each ai.posts frame. */
export function useChannelPosts(conversationId: string, enabled: boolean): AgentPost[] {
  const engine = useEngine();
  const rev = useOrbit((s) => s.aiPostsRev[conversationId] ?? 0);
  const loaded = useLoad(() => (enabled ? channelPosts(engine, conversationId).catch(() => []) : Promise.resolve([] as AgentPost[])), [engine, conversationId, enabled, rev]);
  return loaded.data ?? [];
}

/**
 * The posts to show in the chat: a progress note is dropped once its request has an answer (result, error or
 * approval), so a finished request reads as question and answer.
 */
export function chatPosts(posts: readonly AgentPost[]): AgentPost[] {
  const answered = new Set(posts.filter((p) => p.jobId && (p.kind === "result" || p.kind === "error" || p.kind === "approval")).map((p) => p.jobId));
  return posts.filter((p) => !(p.kind === "progress" && p.jobId && answered.has(p.jobId)));
}

/** The channel's agent posts as timeline entries for MessageList. */
export function useAgentTimeline(orgId: string | null, conversationId: string, agents: ChannelAgent[], canApprove: boolean): { extras: TimelineExtra[]; ui: ReactNode } {
  const posts = useChannelPosts(conversationId, !!orgId && agents.length > 0);
  const me = useOrbit((s) => s.me);
  const users = useOrbit((s) => s.users);
  const [job, setJob] = useState<string | null>(null);
  const extras = useMemo<TimelineExtra[]>(
    () =>
      orgId
        ? chatPosts(posts).map((p) => ({
            id: p.id,
            at: p.createdAt,
            mine: p.kind === "request" && p.authorId === me?.userId,
            node: <AgentChatPost orgId={orgId} post={p} author={p.authorId ? (p.authorId === me?.userId ? me : users[p.authorId]) : undefined} canApprove={canApprove} open={setJob} />,
          }))
        : [],
    [orgId, posts, me, users, canApprove],
  );
  const ui =
    job && orgId ? (
      <Dialog title="Request details" onClose={() => setJob(null)} wide>
        <div className="dialog-body">
          <JobView orgId={orgId} jobId={job} canApprove={canApprove} />
        </div>
      </Dialog>
    ) : null;
  return { extras, ui };
}

interface Author {
  displayName: string;
  avatarColor?: number;
  photoRev?: number | null;
}

/** One post drawn like a chat message: a person's request, or an agent's answer with its AI tag. */
function AgentChatPost({ orgId, post: p, author, canApprove, open }: { orgId: string; post: AgentPost; author: Author | null | undefined; canApprove: boolean; open: (jobId: string) => void }) {
  const isRequest = p.kind === "request";
  const name = isRequest ? (author?.displayName ?? "Someone") : p.agent.displayName;
  return (
    <div className={`msg first agent-msg ${p.kind}`} id={`msg-x-${p.id}`} role="article" aria-label={`${name}${isRequest ? "" : ", AI agent"}, ${fullTime(p.createdAt)}`} tabIndex={-1}>
      <div className="msg-gutter">
        {isRequest && p.authorId ? (
          <UserAvatar userId={p.authorId} name={name} colorIndex={author?.avatarColor ?? 0} photoRev={author?.photoRev} size={38} decorative />
        ) : (
          <AgentAvatar orgId={orgId} installId={p.agent.installId} name={p.agent.displayName} color={p.agent.avatarColor} hasAvatar={p.agent.hasAvatar} size={38} />
        )}
      </div>
      <div className="msg-main">
        <div className="msg-head">
          <strong className="ellipsis">{name}</strong>
          {!isRequest && <span className="ai-tag">AI</span>}
          {isRequest && <small className="faint">to {p.agent.displayName} · not end-to-end encrypted</small>}
          <time dateTime={new Date(p.createdAt).toISOString()} title={fullTime(p.createdAt)}>
            {clock(p.createdAt)}
          </time>
        </div>
        <div className={`msg-text${p.kind === "error" ? " danger-text" : ""}`}>{p.body}</div>
        {p.files.map((f) => (
          <AgentFileView key={f.id} orgId={orgId} file={f} autoPreview={f.mime.startsWith("image/") || f.kind === "preview" || f.kind === "final"} />
        ))}
        {p.jobId && (p.kind === "approval" || p.kind === "result") && (
          <button className="link-button agent-msg-link" onClick={() => open(p.jobId!)}>
            {p.kind === "approval" ? (canApprove ? "Review and approve" : "See the request") : "Details and files"}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * "@Agent …" (or "/agent …") from the composer: sent straight to the agent, like a message to a bot. The notice that
 * it leaves end-to-end encryption is asked once per browser; a request the agent can't take as it stands (it needs a
 * file or more options) opens the full form with the text kept.
 */
export function useAgentMention(orgId: string | null, conversationId: string, agents: ChannelAgent[]): { onAgentRequest: (text: string) => boolean; ui: ReactNode } {
  const engine = useEngine();
  const [form, setForm] = useState<{ installId?: string; brief?: string } | null>(null);
  const [notice, setNotice] = useState<{ installId: string; brief: string; name: string } | null>(null);
  const [failed, setFailed] = useState<{ installId: string; brief: string; name: string; message: string } | null>(null);
  const [sending, setSending] = useState(false);

  const send = async (installId: string, brief: string, name: string) => {
    setSending(true);
    try {
      await createJob(engine, orgId!, { installId, input: { brief }, conversationId, requestText: brief });
    } catch (e) {
      // Needs a file or options the message can't carry: the form explains and keeps the text.
      if (e instanceof ApiError && e.status === 400) setForm({ installId, brief });
      else setFailed({ installId, brief, name, message: e instanceof ApiError ? e.message : "That didn't reach the agent. Try again." });
    } finally {
      setSending(false);
    }
  };

  const onAgentRequest = (text: string): boolean => {
    if (!orgId) return false;
    const inv = agentInvocation(text, agents);
    if (!inv) return false;
    if (!inv.canInvoke || !inv.brief) setForm({ installId: inv.installId, brief: inv.brief });
    else if (!noticeSeen()) setNotice({ installId: inv.installId, brief: inv.brief, name: inv.displayName });
    else void send(inv.installId, inv.brief, inv.displayName);
    return true;
  };

  const ui = (
    <>
      {form && orgId && <ChannelAsk orgId={orgId} conversationId={conversationId} agents={agents} request={form} close={() => setForm(null)} />}
      {notice && (
        <Dialog
          title={`Send to ${notice.name}?`}
          onClose={() => setNotice(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setNotice(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={sending}
                onClick={() => {
                  rememberNotice();
                  const n = notice;
                  setNotice(null);
                  void send(n.installId, n.brief, n.name);
                }}
              >
                Send
              </button>
            </>
          }
        >
          <div className="dialog-body">
            <p style={{ margin: 0 }}>{AI_NOTICE}</p>
            <p className="muted" style={{ margin: 0 }}>
              The request and the answer show in this channel for its members. This is asked once on this browser.
            </p>
          </div>
        </Dialog>
      )}
      {failed && (
        <Dialog
          title={`${failed.name} didn't get that`}
          onClose={() => setFailed(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setFailed(null)}>
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setForm({ installId: failed.installId, brief: failed.brief });
                  setFailed(null);
                }}
              >
                Edit and send
              </button>
            </>
          }
        >
          <div className="dialog-body">
            <div className="banner danger">{failed.message}</div>
          </div>
        </Dialog>
      )}
    </>
  );
  return { onAgentRequest, ui };
}
