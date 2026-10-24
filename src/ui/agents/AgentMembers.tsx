import { useState } from "react";
import { AgentAvatar } from "./AgentBits";
import { ChannelAsk, useChannelAgents } from "./AgentsBar";

/**
 * A channel's AI agents in its member list, under the people (Discord lists bots there too), always with the AI
 * badge. Unlike a Discord bot, an agent isn't a member that reads the channel: it holds no message keys and sees only
 * what someone sends it (server docs/AI_WORKFORCE.md §2), and the section says so. Choosing one opens Ask.
 */
export function AgentMembers({ orgId, conversationId }: { orgId: string; conversationId: string }) {
  const { agents } = useChannelAgents(conversationId, true);
  const [asking, setAsking] = useState<string | null>(null);
  if (agents.length === 0) return null;
  return (
    <section aria-label={`AI agents, ${agents.length}`} className="agent-members">
      <h3 className="member-group">AI agents — {agents.length}</h3>
      <p className="faint member-list-note">They can't read this channel: they see only what you send them.</p>
      {agents.map((a) => (
        <button key={a.id} className="member-row" onClick={() => setAsking(a.id)} aria-label={`${a.displayName}, AI agent: ask`}>
          <AgentAvatar orgId={orgId} installId={a.id} name={a.displayName} color={a.avatarColor} hasAvatar={!!a.avatar} size={34} />
          <span className="lines">
            <span className="member-name ellipsis">
              {a.displayName} <span className="ai-tag">AI</span>
            </span>
            <small className="ellipsis">{a.canInvoke ? a.roleTitle : `${a.roleTitle} · you can't ask it`}</small>
          </span>
        </button>
      ))}
      {asking && <ChannelAsk orgId={orgId} conversationId={conversationId} agents={agents} request={{ installId: asking }} close={() => setAsking(null)} />}
    </section>
  );
}
