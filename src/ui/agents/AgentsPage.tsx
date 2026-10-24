import { Bot, Download, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { type AiOverview, aiCatalog, aiOverview, type CatalogEntry, deliverables, installAgent, JOB_STATE_LABEL, listJobs, pendingApprovals } from "../../sync/aiWorkforce";
import { relative } from "../format";
import { Card, ErrorLine } from "../workspace/WorkspaceView";
import { useAction, useLoad } from "../workspace/useLoad";
import { AgentAvatar, AgentFileView } from "./AgentBits";
import { AgentSettings } from "./AgentSettings";
import { AskAgentDialog } from "./AskAgentDialog";
import { JobView } from "./JobView";

type Tab = "agents" | "manager" | "requests" | "approvals" | "deliverables";

/**
 * Community › AI agents (server docs/AI_WORKFORCE.md): the installed agents and the catalog, the Agent Manager,
 * requests, approvals and deliverables. Members with "Ask AI agents" use them; "Manage AI agents" installs and
 * configures them; "Approve AI agent actions" approves. The server checks every one of these again.
 */
export function AgentsPage({ detail }: { detail: OrgAdminDetail }) {
  const engine = useEngine();
  const orgId = detail.org.id;
  const rev = useOrbit((s) => s.aiJobsRev);
  const overview = useLoad(() => aiOverview(engine, orgId), [engine, orgId, rev]);
  const [tab, setTab] = useState<Tab>("agents");
  // The agent whose settings are open (in this page: routes don't carry an item id).
  const [opened, setOpened] = useState<string | null>(null);
  const o = overview.data;
  if (opened) return <AgentSettings orgId={orgId} installId={opened} onBack={() => setOpened(null)} onChanged={overview.reload} />;
  const tabs: [Tab, string][] = [
    ["agents", "Agents"],
    ["manager", "Agent Manager"],
    ["requests", "Requests"],
    ...(o?.permissions.canApprove ? ([["approvals", "Approvals"]] as [Tab, string][]) : []),
    ["deliverables", "Deliverables"],
  ];
  return (
    <div className="ws-page">
      <ErrorLine text={overview.error} />
      {!o ? (
        !overview.error && <div className="skeleton" style={{ height: 120 }} aria-busy="true" />
      ) : (
        <>
          {!o.enabled && <div className="banner">AI agents aren't available in this community: the platform hasn't switched them on, or doesn't include them here.</div>}
          {o.paused && <div className="banner warn">New requests to agents are paused by the platform for now. Running work finishes.</div>}
          {!o.aiRequestsOn && <div className="banner warn">AI requests are switched off on this platform right now, so agents can't work.</div>}
          <div className="banner info">
            <Sparkles size={16} /> <span className="grow">{o.notice}</span>
          </div>
          <span className="segmented" role="tablist" aria-label="AI agents">
            {tabs.map(([k, label]) => (
              <button key={k} role="tab" aria-selected={tab === k} aria-pressed={tab === k} onClick={() => setTab(k)}>
                {label}
              </button>
            ))}
          </span>
          {tab === "agents" && <AgentsTab orgId={orgId} o={o} reload={overview.reload} open={setOpened} />}
          {tab === "manager" && <ManagerTab orgId={orgId} o={o} />}
          {tab === "requests" && <RequestsTab orgId={orgId} o={o} />}
          {tab === "approvals" && <ApprovalsTab orgId={orgId} o={o} />}
          {tab === "deliverables" && <DeliverablesTab orgId={orgId} />}
        </>
      )}
    </div>
  );
}

function AgentsTab({ orgId, o, reload, open }: { orgId: string; o: AiOverview; reload: () => void; open: (installId: string) => void }) {
  const [browsing, setBrowsing] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);
  return (
    <>
      <Card
        title="Agents in this community"
        sub={o.agents.length ? "Open one to change its name, avatar, tools and channels." : "No agent is installed yet."}
        actions={
          o.permissions.canManage && o.enabled ? (
            <button className="btn btn-primary btn-sm" onClick={() => setBrowsing(true)}>
              <Plus size={14} /> Add agents
            </button>
          ) : undefined
        }
      >
        <ul className="ws-list">
          {o.agents.map((a) => (
            <li key={a.id} className="ws-row">
              <AgentAvatar orgId={orgId} installId={a.id} name={a.displayName} color={a.avatarColor} hasAvatar={!!a.avatar} />
              <span className="lines grow">
                <span>
                  <strong>{a.displayName}</strong> <span className="ai-tag">AI</span> {a.state === "disabled" && <span className="status-pill muted">Off</span>}
                </span>
                <small>
                  {a.roleTitle} · {a.skill?.name ?? a.agentId} · {a.effectiveMode === "review" ? "results reviewed by people" : "works without review"}
                </small>
              </span>
              {o.permissions.canUse && a.state === "active" && (
                <button className="btn btn-sm btn-secondary" onClick={() => setAsking(a.id)}>
                  Ask
                </button>
              )}
              {o.permissions.canManage && (
                <button className="btn btn-sm btn-secondary" onClick={() => open(a.id)}>
                  Settings
                </button>
              )}
            </li>
          ))}
        </ul>
      </Card>
      {browsing && (
        <CatalogDialog
          orgId={orgId}
          onClose={() => setBrowsing(false)}
          onInstalled={(id) => {
            reload();
            open(id);
          }}
        />
      )}
      {asking && (
        <AskAgentDialog
          orgId={orgId}
          agents={o.agents.filter((a) => a.state === "active").map((a) => ({ id: a.id, displayName: a.displayName }))}
          initialAgent={asking}
          onClose={() => setAsking(null)}
          onSent={() => setAsking(null)}
        />
      )}
    </>
  );
}

function CatalogDialog({ orgId, onClose, onInstalled }: { orgId: string; onClose: () => void; onInstalled: (installId: string) => void }) {
  const engine = useEngine();
  const catalog = useLoad(() => aiCatalog(engine, orgId), [engine, orgId]);
  const act = useAction();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const list = (catalog.data ?? []).filter(
    (e: CatalogEntry) => (!category || e.agent.category === category) && (!q || `${e.agent.name} ${e.agent.description} ${e.agent.capabilities.join(" ")}`.toLowerCase().includes(q.toLowerCase())),
  );
  const categories = [...new Set((catalog.data ?? []).map((e) => e.agent.category))].sort();
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Agent catalog" style={{ width: "min(860px, 100%)" }}>
        <div className="dialog-head">
          <h2 className="grow">Agent catalog</h2>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="dialog-body">
          <div className="row" style={{ gap: 8 }}>
            <input className="grow" placeholder="Search agents" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search agents" />
            <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Kind">
              <option value="">All kinds</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <ErrorLine text={catalog.error ?? act.error} />
          {catalog.data && list.length === 0 && <p className="muted">No published agent matches.</p>}
          <div className="agent-catalog">
            {list.map((e) => (
              <article key={e.agent.id} className="card agent-card">
                <header className="row" style={{ gap: 8 }}>
                  <span className="agent-avatar" style={{ width: 32, height: 32, background: e.agent.avatarColor }} aria-hidden="true">
                    <Bot size={18} />
                    <span className="agent-badge">AI</span>
                  </span>
                  <span className="lines grow">
                    <strong>{e.agent.name}</strong>
                    <small className="faint">
                      {e.agent.category} · {e.agent.skill.id} v{e.agent.skill.version}
                    </small>
                  </span>
                </header>
                <p className="muted">{e.agent.description}</p>
                <ul className="agent-caps">
                  {e.agent.capabilities.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                {e.setup.missing.length > 0 && <small className="warn-text">Setup needed: {e.setup.missing.join(" ")}</small>}
                {e.setup.unavailableActions.length > 0 && <small className="faint">Not available here: {e.setup.unavailableActions.join(" ")}</small>}
                {e.installed ? (
                  <span className="status-pill ok">Installed{e.installed.upgradeAvailable ? " · update available" : ""}</span>
                ) : e.available ? (
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={act.busy}
                    onClick={() =>
                      void act.act(async () => {
                        const r = await installAgent(engine, orgId, e.agent.id);
                        onInstalled(r.agent.id);
                      })
                    }
                  >
                    Install
                  </button>
                ) : (
                  <small className="faint">{e.unavailableReason}</small>
                )}
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ManagerTab({ orgId, o }: { orgId: string; o: AiOverview }) {
  const engine = useEngine();
  const manager = o.agents.find((a) => a.agentId === "agent_manager" && a.state === "active");
  const rev = useOrbit((s) => s.aiJobsRev);
  const jobs = useLoad(() => listJobs(engine, orgId, "mine"), [engine, orgId, rev]);
  const [asking, setAsking] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  if (!manager)
    return (
      <Card title="Agent Manager" sub="Plans a request, hands parts of it to this community's agents, follows their work and reports what they produced.">
        <p className="muted" style={{ margin: 0 }}>
          {o.permissions.canManage ? "Install the Agent Manager from Agents › Add agents." : "Ask someone who manages AI agents here to install the Agent Manager."}
        </p>
      </Card>
    );
  const mine = (jobs.data?.jobs ?? []).filter((j) => j.agent.installId === manager.id);
  return (
    <>
      <Card
        title={manager.displayName}
        sub="Describe what you need. It answers directly, asks you a question, or splits the work between the agents you can use, as you."
        actions={
          o.permissions.canUse ? (
            <button className="btn btn-primary btn-sm" onClick={() => setAsking(true)}>
              <Plus size={14} /> New request
            </button>
          ) : undefined
        }
      >
        <ul className="ws-list">
          {mine.length === 0 && <li className="muted">No request yet.</li>}
          {mine.map((j) => (
            <li key={j.id} className="ws-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <button className="row agent-row-toggle" onClick={() => setOpen(open === j.id ? null : j.id)}>
                <span className="grow">{relative(j.createdAt)}</span>
                <span className="status-pill">{JOB_STATE_LABEL[j.state]}</span>
              </button>
              {open === j.id && <JobView orgId={orgId} jobId={j.id} canApprove={o.permissions.canApprove} canManage={o.permissions.canManage} />}
            </li>
          ))}
        </ul>
      </Card>
      {asking && (
        <AskAgentDialog
          orgId={orgId}
          agents={[{ id: manager.id, displayName: manager.displayName }]}
          initialAgent={manager.id}
          onClose={() => setAsking(false)}
          onSent={(j) => {
            setAsking(false);
            setOpen(j.id);
          }}
        />
      )}
    </>
  );
}

function RequestsTab({ orgId, o }: { orgId: string; o: AiOverview }) {
  const engine = useEngine();
  const rev = useOrbit((s) => s.aiJobsRev);
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const jobs = useLoad(() => listJobs(engine, orgId, scope), [engine, orgId, scope, rev]);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Card
      title="Requests"
      sub="Requests to agents, newest first. Open one to see its progress, files and what it waits for."
      actions={
        o.permissions.canManage ? (
          <span className="segmented" role="group" aria-label="Whose">
            <button aria-pressed={scope === "mine"} onClick={() => setScope("mine")}>
              Mine
            </button>
            <button aria-pressed={scope === "all"} onClick={() => setScope("all")}>
              Everyone's
            </button>
          </span>
        ) : undefined
      }
    >
      <ErrorLine text={jobs.error} />
      <ul className="ws-list">
        {jobs.data?.jobs.length === 0 && <li className="muted">No request yet.</li>}
        {jobs.data?.jobs.map((j) => (
          <li key={j.id} className="ws-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <button className="row agent-row-toggle" onClick={() => setOpen(open === j.id ? null : j.id)}>
              <strong className="grow">{j.agent.displayName}</strong>
              <span className="faint">{relative(j.createdAt)}</span>
              <span className="status-pill">{JOB_STATE_LABEL[j.state]}</span>
            </button>
            {open === j.id && <JobView orgId={orgId} jobId={j.id} canApprove={o.permissions.canApprove} canManage={o.permissions.canManage} />}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ApprovalsTab({ orgId, o }: { orgId: string; o: AiOverview }) {
  const engine = useEngine();
  const rev = useOrbit((s) => s.aiJobsRev);
  const list = useLoad(() => pendingApprovals(engine, orgId), [engine, orgId, rev]);
  return (
    <Card title="Waiting for approval" sub="Each approval is for exactly the version shown. A change request makes a new version and voids this one.">
      <ErrorLine text={list.error} />
      {list.data?.length === 0 && <p className="muted">Nothing waits for approval.</p>}
      {list.data?.map((a) => (
        <div key={a.id} className="card">
          <JobView orgId={orgId} jobId={a.jobId} canApprove={o.permissions.canApprove} canManage={o.permissions.canManage} />
        </div>
      ))}
    </Card>
  );
}

function DeliverablesTab({ orgId }: { orgId: string }) {
  const engine = useEngine();
  const rev = useOrbit((s) => s.aiJobsRev);
  const [before, setBefore] = useState<number | undefined>(undefined);
  const files = useLoad(() => deliverables(engine, orgId, before), [engine, orgId, before, rev]);
  return (
    <Card title="Deliverables" sub="Files agents made that you can open: from your requests, and from channels you're in. Kept 30 days.">
      <ErrorLine text={files.error} />
      {files.data?.files.length === 0 && <p className="muted">No deliverable yet.</p>}
      {files.data?.files.map((f) => (
        <AgentFileView key={f.id} orgId={orgId} file={f} />
      ))}
      {files.data?.next && (
        <button className="btn btn-secondary btn-sm" onClick={() => setBefore(files.data!.next!)}>
          <Download size={14} /> Older
        </button>
      )}
    </Card>
  );
}
