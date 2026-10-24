import { Bot, Plus } from "lucide-react";
import { useEngine, useOrbit } from "../../application/orbit";
import { commandName } from "../../sync/agentRules";
import { type AiPermissions, type ChannelAgent, channelAgents } from "../../sync/aiWorkforce";
import { useLoad } from "../workspace/useLoad";
import { AskAgentDialog } from "./AskAgentDialog";

const NONE = { agents: [] as ChannelAgent[], permissions: { canUse: false, canManage: false, canApprove: false } as AiPermissions };

/** The AI agents assigned to a channel and what this person may do with them (none without AI Workforce, or in DMs). */
export function useChannelAgents(conversationId: string, isChannel: boolean): typeof NONE {
  const engine = useEngine();
  const available = useOrbit((s) => s.server?.features.includes("ai-workforce") ?? false);
  const rev = useOrbit((s) => s.aiPostsRev[conversationId] ?? 0);
  const loaded = useLoad(() => (available && isChannel ? channelAgents(engine, conversationId).catch(() => NONE) : Promise.resolve(NONE)), [engine, conversationId, available, isChannel, rev]);
  return loaded.data ?? NONE;
}

/**
 * The channel's agents above its messages: who works here, how to ask them, and the Ask button. Their requests and
 * answers show among the messages (AgentChat), like a bot's.
 */
export function AgentsBar({ agents, ask }: { orgId: string; conversationId: string; agents: ChannelAgent[]; canApprove: boolean; ask: (installId?: string) => void }) {
  if (!agents.length) return null;
  const first = agents[0]!;
  const how = first.activation === "command" ? `/${commandName(first.displayName)}` : `@${first.displayName}`;
  return (
    <div className="conv-banners">
      <div className="banner info agent-bar">
        <Bot size={16} />
        <span className="grow ellipsis">
          {agents.map((a) => a.displayName).join(", ")} {agents.length === 1 ? "works" : "work"} here · type {how} and your question
        </span>
        <button className="btn btn-sm btn-secondary" onClick={() => ask()}>
          <Plus size={14} /> Ask an agent
        </button>
      </div>
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
