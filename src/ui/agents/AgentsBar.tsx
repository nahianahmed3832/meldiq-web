import { Bot, Plus } from "lucide-react";
import { useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { AI_NOTICE, type AgentPost, type AiPermissions, type ChannelAgent, channelAgents, channelPosts } from "../../sync/aiWorkforce";
import { Dialog } from "../components/Overlay";
import { relative } from "../format";
import { useLoad } from "../workspace/useLoad";
import { AgentAvatar, AgentFileView } from "./AgentBits";
import { AskAgentDialog } from "./AskAgentDialog";
import { JobView } from "./JobView";

const NONE = { agents: [] as ChannelAgent[], permissions: { canUse: false, canManage: false, canApprove: false } as AiPermissions };

/** The AI agents assigned to a channel and what this person may do with them (none without AI Workforce, or in DMs). */
export function useChannelAgents(conversationId: string, isChannel: boolean): typeof NONE {
  const engine = useEngine();
  const available = useOrbit((s) => s.server?.features.includes("ai-workforce") ?? false);
  const rev = useOrbit((s) => s.aiPostsRev[conversationId] ?? 0);
  const loaded = useLoad(() => (available && isChannel ? channelAgents(engine, conversationId).catch(() => NONE) : Promise.resolve(NONE)), [engine, conversationId, available, isChannel, rev]);
  return loaded.data ?? NONE;
}

function PostItem({ orgId, post, author, canApprove, open }: { orgId: string; post: AgentPost; author: string | null; canApprove: boolean; open: (jobId: string) => void }) {
  if (post.kind === "request") {
    return (
      <li className="ws-row agent-post request">
        <span className="lines grow">
          <small>
            {author ?? "Someone"} asked {post.agent.displayName} · {relative(post.createdAt)}
          </small>
          <span className="agent-body">{post.body}</span>
        </span>
      </li>
    );
  }
  return (
    <li className={`ws-row agent-post ${post.kind}`}>
      <AgentAvatar orgId={orgId} installId={post.agent.installId} name={post.agent.displayName} color={post.agent.avatarColor} hasAvatar={post.agent.hasAvatar} />
      <span className="lines grow">
        <small>
          <strong>{post.agent.displayName}</strong> · AI{post.agent.skill ? ` · ${post.agent.skill}` : ""} · {relative(post.createdAt)}
        </small>
        <span className="agent-body">{post.body}</span>
        {post.files.map((f) => (
          <AgentFileView key={f.id} orgId={orgId} file={f} autoPreview={f.mime.startsWith("image/") || f.kind === "preview" || f.kind === "final"} />
        ))}
        {post.jobId && (
          <button className="link-button" style={{ justifySelf: "start" }} onClick={() => open(post.jobId!)}>
            {post.kind === "approval" ? (canApprove ? "Review and approve" : "Open the request") : "Open the request"}
          </button>
        )}
      </span>
    </li>
  );
}

/**
 * Agents in a channel: who's assigned, what they posted (kept by the server, not end-to-end encrypted), their
 * requests and approvals, and asking one. Stays out of the way until opened.
 */
export function AgentsBar({
  orgId,
  conversationId,
  agents,
  canApprove,
  ask,
}: {
  orgId: string;
  conversationId: string;
  agents: ChannelAgent[];
  canApprove: boolean;
  ask: (installId?: string) => void;
}) {
  const engine = useEngine();
  const rev = useOrbit((s) => s.aiPostsRev[conversationId] ?? 0);
  const users = useOrbit((s) => s.users);
  const posts = useLoad(() => (agents.length ? channelPosts(engine, conversationId) : Promise.resolve([])), [engine, conversationId, agents.length, rev]);
  const [open, setOpen] = useState(false);
  const [job, setJob] = useState<string | null>(null);
  if (!agents.length) return null;
  const list = posts.data ?? [];
  const latest = list.filter((p) => p.kind !== "request").at(-1);
  const waiting = list.filter((p) => p.kind === "approval").length;
  return (
    <div className="conv-banners">
      <div className="banner info agent-bar">
        <Bot size={16} />
        <button className="grow ellipsis link-button" style={{ textAlign: "left" }} onClick={() => setOpen(true)}>
          {agents.map((a) => a.displayName).join(", ")} {agents.length === 1 ? "works" : "work"} here
          {latest ? ` · ${latest.agent.displayName}: ${latest.body.split("\n")[0]}` : ""}
        </button>
        {waiting > 0 && <span className="status-pill warn">Approval</span>}
        <button className="btn btn-sm btn-secondary" onClick={() => ask()}>
          <Plus size={14} /> Ask an agent
        </button>
      </div>
      {open && (
        <Dialog title="AI agents in this channel" onClose={() => setOpen(false)} wide>
          <div className="dialog-body">
            <div className="banner warn">{AI_NOTICE} Their posts are kept for 30 days and readable by this channel's members.</div>
            <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
              {agents.map((a) => (
                <span key={a.id} className="row" style={{ gap: 6 }}>
                  <AgentAvatar orgId={orgId} installId={a.id} name={a.displayName} color={a.avatarColor} hasAvatar={!!a.avatar} size={24} />
                  <span>
                    {a.displayName} <small className="faint">{a.activation === "mention" ? `@${a.displayName}` : a.activation === "command" ? "by command" : "from the Ask button"}</small>
                  </span>
                </span>
              ))}
            </div>
            {posts.error && <div className="banner danger">{posts.error}</div>}
            {list.length === 0 ? (
              <p className="muted">Nothing yet. Ask an agent to get started.</p>
            ) : (
              <ul className="ws-list">
                {list.map((p) => (
                  <PostItem key={p.id} orgId={orgId} post={p} author={p.authorId ? (users[p.authorId]?.displayName ?? null) : null} canApprove={canApprove} open={setJob} />
                ))}
              </ul>
            )}
            {job && (
              <div className="card">
                <JobView orgId={orgId} jobId={job} canApprove={canApprove} />
              </div>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
}

/** The Ask dialog for a channel, opened from the bar or from a message that names an agent. */
export function ChannelAsk({
  orgId,
  conversationId,
  agents,
  request,
  close,
}: {
  orgId: string;
  conversationId: string;
  agents: ChannelAgent[];
  request: { installId?: string; brief?: string };
  close: () => void;
}) {
  return (
    <AskAgentDialog
      orgId={orgId}
      agents={agents.map((a) => ({ id: a.id, displayName: a.displayName, canInvoke: a.canInvoke }))}
      initialAgent={request.installId ?? null}
      initialBrief={request.brief ?? ""}
      conversationId={conversationId}
      onClose={close}
      onSent={close}
    />
  );
}
