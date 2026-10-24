import { MessageSquare } from "lucide-react";
import { useState } from "react";
import { useEngine } from "../../application/orbit";
import { navigate } from "../../application/router";
import { directConversation } from "../../sync/aiWorkforce";
import { AgentAvatar } from "./AgentBits";
import { useReaders } from "./AgentReaders";
import { ChannelAsk, useChannelAgents } from "./AgentsBar";

/**
 * A channel's AI agents in its member list, under the people (Discord lists bots there too), always with the AI
 * badge. An agent reads the channel only where its managers switched reading on (and then only what each member
 * shares), and the section says which ones do. Choosing one opens Ask; Message opens a direct conversation with it.
 */
export function AgentMembers({ orgId, conversationId }: { orgId: string; conversationId: string }) {
  const engine = useEngine();
  const { agents } = useChannelAgents(conversationId, true);
  const readers = useReaders(conversationId);
  const [asking, setAsking] = useState<string | null>(null);
  if (agents.length === 0) return null;
  const reading = new Set(readers.readers.map((r) => r.installId));
  const message = (installId: string) =>
    void directConversation(engine, orgId, installId)
      .then((cid) => navigate({ section: "dms", conversationId: cid }))
      .catch((e: unknown) => engine.notice("error", e instanceof Error ? e.message : "Couldn't open the conversation"));
  return (
    <section aria-label={`AI agents, ${agents.length}`} className="agent-members">
      <h3 className="member-group">AI agents — {agents.length}</h3>
      <p className="faint member-list-note">
        {reading.size ? "Agents marked “reads here” read new messages from members who share theirs." : "They can't read this channel: they see only what you send them."}
      </p>
      {agents.map((a) => (
        <div key={a.id} className="member-row-wrap">
          <button className="member-row" onClick={() => setAsking(a.id)} aria-label={`${a.displayName}, AI agent: ask`}>
            <AgentAvatar orgId={orgId} installId={a.id} name={a.displayName} color={a.avatarColor} hasAvatar={!!a.avatar} size={34} />
            <span className="lines">
              <span className="member-name ellipsis">
                {a.displayName} <span className="ai-tag">AI</span>
              </span>
              <small className="ellipsis">
                {a.canInvoke ? a.roleTitle : `${a.roleTitle} · you can't ask it`}
                {reading.has(a.id) ? " · reads here" : ""}
              </small>
            </span>
          </button>
          {a.canInvoke && (
            <button className="icon-btn" aria-label={`Message ${a.displayName}`} title={`Message ${a.displayName}`} onClick={() => message(a.id)}>
              <MessageSquare size={16} />
            </button>
          )}
        </div>
      ))}
      {asking && <ChannelAsk orgId={orgId} conversationId={conversationId} agents={agents} request={{ installId: asking }} close={() => setAsking(null)} />}
    </section>
  );
}
