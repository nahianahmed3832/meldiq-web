import { ArrowLeft, Plus } from "lucide-react";
import { useState } from "react";
import { useEngine } from "../../../app/orbit";
import { navigate } from "../../../app/router";
import { listDocuments } from "../../../sync/documents";
import {
  AI_MODE_LABEL,
  AI_MODES,
  AUTO_INTENTS,
  checkInboxAccount,
  connectInboxAccount,
  createInboxQueue,
  disconnectInboxAccount,
  inboxAccounts,
  inboxAgents,
  type InboxProvider,
  inboxProviders,
  inboxQueues,
  inboxReport,
  type InboxSettings,
  inboxSettings,
  INTENT_LABEL,
  minutesLabel,
  saveInboxSettings,
} from "../../../sync/inbox";
import { Dialog } from "../../components/Overlay";
import { useAction, useLoad } from "../useLoad";
import { Card, ErrorLine } from "../WorkspaceView";

const REPORT_DAYS = 30;
const MAX_TARGET_MINUTES = 10_080;
const MAX_RETENTION_DAYS = 3650;
const digits = (v: string, max: number) => Math.min(Number(v.replace(/\D/g, "").slice(0, 5) || 0), max);

const STATE_TEXT = (p: InboxProvider) =>
  p.state === "ready" ? "Ready to connect" : p.state === "needs_configuration" ? `Server setup needed: ${p.missing.join(", ")}` : "Awaiting access from the platform";
const HEALTH_TEXT: Record<string, string> = { active: "Working", needs_reauth: "Needs reconnecting" };

/**
 * Inbox setup for inbox admins (android round 8 InboxSetupScreen): which platforms this server can use and what's
 * missing, connected business accounts and their health, queues, AI and automation, response target, retention, and
 * the last 30 days. Nothing here pretends a platform works before it's set up and verified.
 */
export function InboxSetup({ orgId }: { orgId: string }) {
  const engine = useEngine();
  const [tick, setTick] = useState(0);
  const providers = useLoad(() => inboxProviders(engine, orgId), [engine, orgId, tick]);
  const accounts = useLoad(() => inboxAccounts(engine, orgId), [engine, orgId, tick]);
  const queues = useLoad(() => inboxQueues(engine, orgId), [engine, orgId, tick]);
  const agents = useLoad(() => inboxAgents(engine, orgId), [engine, orgId]);
  const report = useLoad(() => inboxReport(engine, orgId, REPORT_DAYS), [engine, orgId, tick]);
  const [connecting, setConnecting] = useState<InboxProvider | null>(null);
  const [newQueue, setNewQueue] = useState(false);
  const act = useAction();
  const reload = () => setTick((t) => t + 1);
  const r = report.data;
  return (
    <div className="ws-page">
      <button className="btn btn-ghost btn-sm" style={{ justifySelf: "start" }} onClick={() => navigate({ section: "workspace", workspacePage: "inbox" })}>
        <ArrowLeft size={14} /> Customer inbox
      </button>
      <ErrorLine text={act.error} />
      <Card title="Platforms" sub="Each platform says what this server still needs. Accounts connect with the token Meta issued for them, never a password.">
        <ErrorLine text={providers.error} />
        <ul className="ws-list">
          {(providers.data ?? []).map((p) => (
            <li key={p.id} className="ws-row" style={{ alignItems: "flex-start" }}>
              <span className={`ib-badge ib-${p.id}`}>{p.name}</span>
              <span className="lines grow">
                <strong>{STATE_TEXT(p)}</strong>
                <small className="faint">{p.eligibility}</small>
                {p.webhookUrl && <small className="faint mono ellipsis">Webhook URL for Meta: {p.webhookUrl}</small>}
              </span>
              {p.state === "ready" && (
                <button className="btn btn-secondary btn-sm" onClick={() => setConnecting(p)}>
                  Connect
                </button>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Connected accounts">
        <ErrorLine text={accounts.error} />
        {accounts.data?.length === 0 && <p className="faint">No business accounts connected yet.</p>}
        <ul className="ws-list">
          {(accounts.data ?? []).map((a) => (
            <li key={a.id} className="ws-row">
              <span className="lines grow">
                <strong>{a.name}</strong>
                <small className={a.status === "active" ? "faint" : "danger-text"}>
                  {[a.providerName, a.number, HEALTH_TEXT[a.status] ?? `Error: ${a.lastError ?? "?"}`].filter(Boolean).join(" · ")}
                </small>
              </span>
              <button className="btn btn-secondary btn-sm" disabled={act.busy} onClick={() => void act.act(() => checkInboxAccount(engine, orgId, a.id).then(reload))}>
                Check connection
              </button>
              <button className="btn btn-ghost btn-sm danger-text" disabled={act.busy} onClick={() => void act.act(() => disconnectInboxAccount(engine, orgId, a.id).then(reload))}>
                Disconnect
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <Card
        title="Queues"
        actions={
          <button className="btn btn-secondary btn-sm" onClick={() => setNewQueue(true)}>
            <Plus size={14} /> New queue
          </button>
        }
      >
        {queues.data?.length === 0 && <p className="faint">No queues yet.</p>}
        <ul className="ws-list">
          {(queues.data ?? []).map((q) => (
            <li key={q.id} className="ws-row">
              <span className="grow">{q.name}</span>
              <small className="faint">{q.memberIds.length === 1 ? "1 person" : `${q.memberIds.length} people`}</small>
            </li>
          ))}
        </ul>
      </Card>
      <SettingsCard orgId={orgId} queues={queues.data ?? []} />
      {r && (
        <Card title={`Last ${r.days} days`}>
          <p className="faint" style={{ margin: 0, whiteSpace: "pre-line" }}>
            {`Received ${r.messages.received} · replied ${r.messages.sentByPeople} · automatic ${r.messages.sentAutomatically} · failed ${r.messages.failed}\n`}
            {`Started ${r.conversations.started} · resolved ${r.conversations.resolved} · escalated ${r.escalations}\n`}
            {`Median first response ${minutesLabel(r.times.medianFirstResponseMs) ?? "–"}`}
          </p>
        </Card>
      )}
      {connecting && (
        <ConnectDialog
          provider={connecting}
          onClose={() => setConnecting(null)}
          onConnect={(input) =>
            void act.act(async () => {
              setConnecting(null);
              await connectInboxAccount(engine, orgId, input);
              reload();
            })
          }
        />
      )}
      {newQueue && (
        <QueueDialog
          agents={agents.data ?? []}
          onClose={() => setNewQueue(false)}
          onSave={(name, memberIds) =>
            void act.act(async () => {
              setNewQueue(false);
              await createInboxQueue(engine, orgId, name, memberIds);
              reload();
            })
          }
        />
      )}
    </div>
  );
}

function SettingsCard({ orgId, queues }: { orgId: string; queues: { id: string; name: string }[] }) {
  const engine = useEngine();
  const loaded = useLoad(() => inboxSettings(engine, orgId).then((s) => s.settings), [engine, orgId]);
  const docs = useLoad(() => listDocuments(engine, orgId).then((d) => d.filter((x) => x.access === "workspace")), [engine, orgId]);
  const [draft, setDraft] = useState<InboxSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const act = useAction();
  const s = draft ?? loaded.data;
  if (!s) return <ErrorLine text={loaded.error} />;
  const change = (next: Partial<InboxSettings>) => {
    setDraft({ ...s, ...next });
    setSaved(false);
  };
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  return (
    <Card title="Responses and AI">
      <div className="field">
        <span>AI in the inbox</span>
        <span className="segmented" role="group" aria-label="AI in the inbox">
          {AI_MODES.map((m) => (
            <button key={m} aria-pressed={s.aiMode === m} onClick={() => change({ aiMode: m })}>
              {AI_MODE_LABEL[m]}
            </button>
          ))}
        </span>
        <small className="faint">Drafts: AI suggests, a person sends. Automatic: AI answers only the topics you pick, from the documents you approve; anything else goes to a person.</small>
      </div>
      {s.aiMode === "auto" && (
        <>
          <div className="field">
            <span>Topics AI may answer</span>
            <div className="chips search-filters">
              {AUTO_INTENTS.map((i) => (
                <button key={i} className="chip" aria-selected={s.autoIntents.includes(i)} onClick={() => change({ autoIntents: toggle(s.autoIntents, i) })}>
                  {INTENT_LABEL[i]}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>Documents AI may use</span>
            <small className="faint">Only documents shared with the whole workspace.</small>
            <div className="chips search-filters">
              {(docs.data ?? []).map((d) => (
                <button key={d.id} className="chip" aria-selected={s.knowledgeDocumentIds.includes(d.id)} onClick={() => change({ knowledgeDocumentIds: toggle(s.knowledgeDocumentIds, d.id) })}>
                  {d.title}
                </button>
              ))}
              {docs.data?.length === 0 && <small className="faint">No workspace documents yet.</small>}
            </div>
          </div>
          <label className="row" style={{ gap: 8 }}>
            <input type="checkbox" checked={s.autoPaused} onChange={(e) => change({ autoPaused: e.target.checked })} /> Pause automatic replies
          </label>
          <label className="field">
            <span>Holding reply when a person is needed</span>
            <textarea className="input" rows={2} maxLength={500} value={s.autoFallback} onChange={(e) => change({ autoFallback: e.target.value })} />
          </label>
        </>
      )}
      {queues.length > 0 && (
        <label className="field">
          <span>Queue for new conversations</span>
          <select className="input" value={s.defaultQueueId ?? ""} onChange={(e) => change({ defaultQueueId: e.target.value || null })}>
            <option value="">No queue</option>
            {queues.map((q) => (
              <option key={q.id} value={q.id}>
                {q.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="wf-row">
        <label className="field">
          <span>Response target (minutes, 0: none)</span>
          <input className="input" inputMode="numeric" value={s.responseTargetMinutes} onChange={(e) => change({ responseTargetMinutes: digits(e.target.value, MAX_TARGET_MINUTES) })} />
        </label>
        <label className="field">
          <span>Keep messages for (days, 0: until deleted)</span>
          <input className="input" inputMode="numeric" value={s.retentionDays} onChange={(e) => change({ retentionDays: digits(e.target.value, MAX_RETENTION_DAYS) })} />
        </label>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button
          className="btn btn-primary"
          disabled={!draft || act.busy}
          onClick={() =>
            void act.act(async () => {
              setDraft(await saveInboxSettings(engine, orgId, s));
              setSaved(true);
            })
          }
        >
          Save
        </button>
        {saved && <small className="faint">Saved</small>}
      </div>
      <ErrorLine text={act.error} />
    </Card>
  );
}

/** Connecting with the business's own Meta token: never a password, typed into a masked field, never shown again. */
function ConnectDialog({
  provider: p,
  onClose,
  onConnect,
}: {
  provider: InboxProvider;
  onClose: () => void;
  onConnect: (input: { provider: string; externalId: string; token: string; businessAccountId?: string }) => void;
}) {
  const [externalId, setExternalId] = useState("");
  const [waba, setWaba] = useState("");
  const [token, setToken] = useState("");
  const onlyDigits = (v: string) => v.replace(/\D/g, "").slice(0, 30);
  const ready = token.trim().length >= 20 && (p.id === "instagram" || !!externalId) && (p.id !== "whatsapp" || !!waba);
  return (
    <Dialog
      title={`Connect ${p.name}`}
      onClose={onClose}
      footer={
        <button className="btn btn-primary" disabled={!ready} onClick={() => onConnect({ provider: p.id, externalId, token: token.trim(), ...(waba ? { businessAccountId: waba } : {}) })}>
          Connect
        </button>
      }
    >
      <div className="dialog-body">
        <small className="faint">
          Use the token Meta issued for this business account (a Page token, an Instagram professional account token, or a WhatsApp system user token). Never a password. Meldiq checks it with Meta and
          stores it sealed.
        </small>
        {p.id === "messenger" && (
          <label className="field">
            <span>Facebook Page id</span>
            <input className="input" inputMode="numeric" value={externalId} onChange={(e) => setExternalId(onlyDigits(e.target.value))} />
          </label>
        )}
        {p.id === "whatsapp" && (
          <>
            <label className="field">
              <span>WhatsApp phone number id</span>
              <input className="input" inputMode="numeric" value={externalId} onChange={(e) => setExternalId(onlyDigits(e.target.value))} />
            </label>
            <label className="field">
              <span>WhatsApp business account id</span>
              <input className="input" inputMode="numeric" value={waba} onChange={(e) => setWaba(onlyDigits(e.target.value))} />
            </label>
          </>
        )}
        <label className="field">
          <span>Access token</span>
          <input className="input" type="password" autoComplete="off" spellCheck={false} value={token} maxLength={4096} onChange={(e) => setToken(e.target.value)} />
        </label>
      </div>
    </Dialog>
  );
}

function QueueDialog({ agents, onClose, onSave }: { agents: { id: string; name: string }[]; onClose: () => void; onSave: (name: string, memberIds: string[]) => void }) {
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  return (
    <Dialog
      title="New queue"
      onClose={onClose}
      footer={
        <button className="btn btn-primary" disabled={!name.trim()} onClick={() => onSave(name.trim(), picked)}>
          Save
        </button>
      }
    >
      <div className="dialog-body">
        <label className="field">
          <span>Queue name (for example Sales or Support)</span>
          <input className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <div className="chips search-filters" role="group" aria-label="People in the queue">
          {agents.map((a) => (
            <button key={a.id} className="chip" aria-selected={picked.includes(a.id)} onClick={() => setPicked(picked.includes(a.id) ? picked.filter((x) => x !== a.id) : [...picked, a.id])}>
              {a.name}
            </button>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
