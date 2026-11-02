import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import type { OrgAdminDetail } from "../../../api/workspaceSchemas";
import { useEngine, useOrbit } from "../../../application/orbit";
import { OFFICIAL_BOTS_FEATURE } from "../../../sync/officialBots";
import { POSTING_FEATURES, postTicketPanel } from "../../../sync/posting/api";
import { isTicketStaff, looksLikeTicket, maxOpenChoices, type PanelDraft, panelsProblem, ticketError } from "../../../sync/posting/tickets";
import { loadTickets, saveTickets, type TicketsState } from "../../../sync/posting/ticketsBot";
import { rolesOverview } from "../../../sync/roles";
import { Toggle } from "../../components/Toggle";
import { BotField } from "../../workspace/bots/BotParts";
import { useLoad } from "../../workspace/useLoad";
import { Card, ErrorLine } from "../../workspace/WorkspaceView";
import { categoriesOf, panelChannels } from "../panelData";
import { OpenTicketsList } from "./OpenTicketsList";
import { PanelEditor } from "./PanelEditor";

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

interface TicketsCardProps {
  orgId: string;
  /** In the Tickets bot's window, whose own switch is the tickets switch. */
  hideSwitch?: boolean;
}

/**
 * The tickets settings. With official bots they're the Tickets bot's: up to 10 panels and 10 per person, a support role
 * and welcome line per panel, and transcripts with Bots+ (PLUS, locked without it).
 */
export function TicketsCard({ orgId, hideSwitch }: TicketsCardProps) {
  const engine = useEngine();
  const viaBot = useOrbit((s) => s.server?.features.includes(OFFICIAL_BOTS_FEATURE) ?? false);
  const loaded = useLoad(() => loadTickets(engine, orgId, viaBot), [engine, orgId, viaBot]);
  const roles = useLoad(() => (viaBot ? rolesOverview(engine, orgId) : Promise.resolve(null)), [engine, orgId, viaBot]);
  const channels = useOrbit((s) => panelChannels(s, orgId)).filter((c) => !looksLikeTicket(c.name));
  const categories = useOrbit((s) => categoriesOf(s, orgId));
  const [saved, setSaved] = useState<TicketsState | null>(null);
  const [draft, setDraft] = useState<TicketsState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded.data) return;
    setSaved(loaded.data);
    setDraft(loaded.data);
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
  const save = (next: TicketsState) =>
    run(async () => {
      if (!saved) return;
      // Panels kept beyond the free limit (Bots+ ended) only count against it when they're changed.
      const panelsChanged = JSON.stringify(next.panels) !== JSON.stringify(saved.panels);
      const problem = panelsProblem(next.panels, panelsChanged ? next.panelLimit : Number.MAX_SAFE_INTEGER);
      if (problem) throw new Error(problem);
      const fresh = await saveTickets(engine, orgId, saved, next);
      setSaved(fresh);
      setDraft(fresh);
      setNote("Saved.");
    });
  const post = (panelId: string) =>
    void run(async () => {
      await postTicketPanel(engine, orgId, panelId);
      setNote("Panel posted.");
    });

  if (!saved || !draft) return <Card title="Tickets">{loaded.error ? <ErrorLine text={loaded.error} /> : <span className="skeleton" aria-busy="true" style={{ height: 40 }} />}</Card>;
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);
  const setPanel = (i: number, next: PanelDraft) => setDraft({ ...draft, panels: draft.panels.map((x, j) => (j === i ? next : x)) });
  const givable = (roles.data?.roles ?? []).filter((r) => !r.archived);

  return (
    <Card title="Tickets" sub="Members open a private channel with your moderators from the community menu or a panel's button. The opener or any moderator closes it.">
      <ErrorLine text={error} />
      {!hideSwitch && (
        <div className="setting">
          <span className="lines">
            <strong>Let members open tickets</strong>
            <small>Tickets land in a Tickets category. Closing one archives its channel.</small>
          </span>
          <Toggle checked={saved.enabled} disabled={busy} onChange={(v) => void save({ ...draft, enabled: v })} label="Let members open tickets" />
        </div>
      )}
      <BotField
        label="Open tickets per person"
        botsPlus={draft.botsPlus}
        paused={draft.paused.includes("maxOpenPerPerson")}
        hint={draft.viaBot && !draft.botsPlus ? "Up to 3; up to 10 with Bots+." : undefined}
      >
        <div className="segmented" role="radiogroup" aria-label="Open tickets per person">
          {maxOpenChoices(draft.maxOpenLimit).map((n) => (
            <button key={n} type="button" role="radio" aria-checked={draft.maxOpenPerPerson === n} onClick={() => setDraft({ ...draft, maxOpenPerPerson: n })}>
              {n}
            </button>
          ))}
        </div>
      </BotField>
      {draft.panels.map((p, i) => (
        <PanelEditor
          key={p.id ?? `new-${i}`}
          panel={p}
          index={i}
          channels={channels}
          categories={categories}
          extras={draft.viaBot}
          botsPlus={draft.botsPlus}
          roles={givable}
          canPost={saved.enabled && !!p.id && saved.panels.some((x) => x.id === p.id)}
          posted={!!saved.panels.find((x) => x.id === p.id)?.postedMessageId}
          busy={busy || dirty}
          onChange={(next) => setPanel(i, next)}
          onRemove={() => setDraft({ ...draft, panels: draft.panels.filter((_, j) => j !== i) })}
          onPost={() => p.id && post(p.id)}
        />
      ))}
      {draft.viaBot && (
        <BotField label="Transcripts" plus botsPlus={draft.botsPlus} paused={draft.paused.includes("transcripts")}>
          <div className="setting">
            <span className="lines">
              <small>When a ticket closes, its messages go to the panel's log channel as text.</small>
            </span>
            <Toggle checked={draft.transcripts} onChange={(v) => setDraft({ ...draft, transcripts: v })} label="Transcripts" />
          </div>
        </BotField>
      )}
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={draft.panels.length >= draft.panelLimit}
          onClick={() => setDraft({ ...draft, panels: [...draft.panels, { name: "", postChannelId: "", categoryId: null, logChannelId: null, supportRoleId: null, welcomeMessage: null }] })}
        >
          <Plus size={14} /> {draft.panels.length ? "Add another panel" : "Add a panel"}
        </button>
        <small className="faint">
          {draft.panels.length} of {draft.panelLimit} panels{draft.viaBot && !draft.botsPlus ? " (10 with Bots+)" : ""}
        </small>
        <span className="grow" />
        {note && (
          <small className="faint" role="status">
            {note}
          </small>
        )}
        <button type="button" className="btn btn-primary btn-sm" disabled={busy || !dirty} onClick={() => void save(draft)}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </Card>
  );
}
