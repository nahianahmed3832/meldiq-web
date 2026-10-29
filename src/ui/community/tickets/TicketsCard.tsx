import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import type { OrgAdminDetail } from "../../../api/workspaceSchemas";
import { useEngine, useOrbit } from "../../../application/orbit";
import { POSTING_FEATURES, postTicketPanel, saveTicketsConfig, type TicketsConfig, ticketsConfig } from "../../../sync/posting/api";
import { isTicketStaff, looksLikeTicket, MAX_OPEN_CHOICES, type PanelDraft, panelsProblem, ticketError } from "../../../sync/posting/tickets";
import { Toggle } from "../../components/Toggle";
import { useLoad } from "../../workspace/useLoad";
import { Card, ErrorLine } from "../../workspace/WorkspaceView";
import { categoriesOf, panelChannels } from "../panelData";
import { OpenTicketsList } from "./OpenTicketsList";
import { PanelEditor } from "./PanelEditor";

interface Draft {
  maxOpenPerPerson: number;
  panels: PanelDraft[];
}

const draftOf = (c: TicketsConfig): Draft => ({
  maxOpenPerPerson: c.maxOpenPerPerson,
  panels: c.panels.map((p) => ({ id: p.id, name: p.name, postChannelId: p.postChannelId ?? "", categoryId: p.categoryId, logChannelId: p.logChannelId })),
});

/**
 * Community settings › Profile › Tickets (the reference's "Let members open tickets" and its Tickets bot): the switch,
 * open tickets per person, the panels, and for moderators the open tickets. Shown on servers with tickets.
 */
export function TicketsSection({ detail }: { detail: OrgAdminDetail }) {
  const offered = useOrbit((s) => s.server?.features.includes(POSTING_FEATURES.tickets) ?? false);
  const p = detail.permissions;
  if (!offered) return null;
  return (
    <>
      {p.canManageOrg && <TicketsCard orgId={detail.org.id} />}
      {isTicketStaff(p) && <OpenTicketsList orgId={detail.org.id} />}
    </>
  );
}

function TicketsCard({ orgId }: { orgId: string }) {
  const engine = useEngine();
  const loaded = useLoad(() => ticketsConfig(engine, orgId), [engine, orgId]);
  const channels = useOrbit((s) => panelChannels(s, orgId)).filter((c) => !looksLikeTicket(c.name));
  const categories = useOrbit((s) => categoriesOf(s, orgId));
  const [config, setConfig] = useState<TicketsConfig | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded.data) return;
    setConfig(loaded.data);
    setDraft(draftOf(loaded.data));
  }, [loaded.data]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await fn();
    } catch (e) {
      setError(ticketError(e));
    } finally {
      setBusy(false);
    }
  };
  const save = (enabled: boolean, d: Draft) =>
    run(async () => {
      const problem = panelsProblem(d.panels, config?.panelLimit ?? 2);
      if (problem) throw new Error(problem);
      const saved = await saveTicketsConfig(engine, orgId, { enabled, maxOpenPerPerson: d.maxOpenPerPerson, panels: d.panels });
      setConfig(saved);
      setDraft(draftOf(saved));
      setNote("Saved.");
    });
  const post = (panelId: string) =>
    void run(async () => {
      await postTicketPanel(engine, orgId, panelId);
      setNote("Panel posted.");
    });

  if (!config || !draft) return <Card title="Tickets">{loaded.error ? <ErrorLine text={loaded.error} /> : <span className="skeleton" aria-busy="true" style={{ height: 40 }} />}</Card>;
  const dirty = JSON.stringify(draftOf(config)) !== JSON.stringify(draft);
  const setPanel = (i: number, next: PanelDraft) => setDraft({ ...draft, panels: draft.panels.map((x, j) => (j === i ? next : x)) });

  return (
    <Card title="Tickets" sub="Members open a private channel with your moderators from the community menu or a panel's button. The opener or any moderator closes it.">
      <ErrorLine text={error} />
      <div className="setting">
        <span className="lines">
          <strong>Let members open tickets</strong>
          <small>Tickets land in a Tickets category. Closing one archives its channel.</small>
        </span>
        <Toggle checked={config.enabled} disabled={busy} onChange={(v) => void save(v, draft)} label="Let members open tickets" />
      </div>
      <div className="field">
        <span className="label">Open tickets per person</span>
        <div className="segmented" role="radiogroup" aria-label="Open tickets per person">
          {MAX_OPEN_CHOICES.map((n) => (
            <button key={n} type="button" role="radio" aria-checked={draft.maxOpenPerPerson === n} onClick={() => setDraft({ ...draft, maxOpenPerPerson: n })}>
              {n}
            </button>
          ))}
        </div>
      </div>
      {draft.panels.map((p, i) => (
        <PanelEditor
          key={p.id ?? `new-${i}`}
          panel={p}
          index={i}
          channels={channels}
          categories={categories}
          canPost={config.enabled && !!p.id && config.panels.some((x) => x.id === p.id)}
          posted={!!config.panels.find((x) => x.id === p.id)?.postedMessageId}
          busy={busy || dirty}
          onChange={(next) => setPanel(i, next)}
          onRemove={() => setDraft({ ...draft, panels: draft.panels.filter((_, j) => j !== i) })}
          onPost={() => p.id && post(p.id)}
        />
      ))}
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={draft.panels.length >= config.panelLimit}
          onClick={() => setDraft({ ...draft, panels: [...draft.panels, { name: "", postChannelId: "", categoryId: null, logChannelId: null }] })}
        >
          <Plus size={14} /> {draft.panels.length ? "Add another panel" : "Add a panel"}
        </button>
        <small className="faint">
          {draft.panels.length} of {config.panelLimit} panels
        </small>
        <span className="grow" />
        {note && (
          <small className="faint" role="status">
            {note}
          </small>
        )}
        <button type="button" className="btn btn-primary btn-sm" disabled={busy || !dirty} onClick={() => void save(config.enabled, draft)}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </Card>
  );
}
