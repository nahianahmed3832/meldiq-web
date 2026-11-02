import { BotTag } from "../../components/BotTag";
import { BotDiagnostics } from "./BotDiagnostics";
import { Check, Clock, X } from "lucide-react";
import { type CSSProperties, useMemo, useState } from "react";
import { useEngine, useOrbit } from "../../../application/orbit";
import { POSTING_FEATURES } from "../../../sync/posting/api";
import { type AnySettings, changedSettings, cleanSettings, hasSettings, plusNeeded, settingsDraft, settingsProblem } from "../../../sync/officialBotRules";
import { type CatalogBot, isUnavailable, type OfficialBot, officialBotError, updateOfficialBot } from "../../../sync/officialBots";
import { rolesOverview } from "../../../sync/roles";
import { TicketsCard } from "../../community/tickets/TicketsCard";
import { panelChannels } from "../../community/panelData";
import { Dialog } from "../../components/Overlay";
import { Toggle } from "../../components/Toggle";
import { useLoad } from "../useLoad";
import { BotIcon, FreePlusTable, PlusUpsell, textChannels } from "./BotParts";
import { AlertsWatches } from "./AlertsWatches";
import { BotLook } from "./BotLook";
import { BotSettingsForm } from "./BotSettingsForm";

export interface BotWindowProps {
  orgId: string;
  orgName: string;
  memberCount: number;
  catalog: CatalogBot;
  bot: OfficialBot | null;
  botsPlus: boolean;
  perks: string[];
  canEdit: boolean;
  onChanged: (bot: OfficialBot) => void;
  onClose: () => void;
}

const ROLE_BOTS = new Set(["levels", "giveaways", "alerts"]);

/** Why the bot can't be turned on here (the server's reason), or null when it can. */
function unavailableNote(catalog: CatalogBot, bot: OfficialBot | null): string | null {
  if (catalog.available && bot?.available !== false) return null;
  const reason = bot?.unavailableReason ?? catalog.unavailableReason;
  return reason ? `${catalog.name} isn't available here: ${reason}.` : `${catalog.name} is coming soon: it can't be turned on yet.`;
}

/**
 * One official bot's window (docs/MELDIQ_COMMUNITY_PARITY.md §1 Bots): coloured header with its picture, name and BOT
 * tag, tagline and On/Off switch; what it does, its chips and a sample message; its look here, its settings, the Free
 * vs Plus table and Save. A bot the server can't run yet opens read-only with the reason.
 */
export function BotWindow({ orgId, orgName, memberCount, catalog, bot, botsPlus, perks, canEdit, onChanged, onClose }: BotWindowProps) {
  const engine = useEngine();
  const diagnosticsOn = useOrbit((s) => s.server?.features.includes("bot-diagnostics") ?? false);
  const key = catalog.key;
  const channels = textChannels(useOrbit((s) => panelChannels(s, orgId)));
  const ticketsOn = useOrbit((s) => s.server?.features.includes(POSTING_FEATURES.tickets) ?? false);
  const roles = useLoad(() => (ROLE_BOTS.has(key) && canEdit ? rolesOverview(engine, orgId) : Promise.resolve(null)), [engine, orgId, key, canEdit]);
  const givable = useMemo(() => (roles.data?.roles ?? []).filter((r) => !r.archived), [roles.data]);
  const [original, setOriginal] = useState<AnySettings>(() => settingsDraft(key, bot?.settings ?? null));
  const [draft, setDraft] = useState<AnySettings>(original);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [unavailable, setUnavailable] = useState<string | null>(unavailableNote(catalog, bot));
  const enabled = bot?.enabled ?? false;
  const dirty = JSON.stringify(original) !== JSON.stringify(draft);
  const readOnly = !canEdit || unavailable !== null;

  const run = async (fn: () => Promise<OfficialBot>): Promise<OfficialBot | null> => {
    setBusy(true);
    setError(null);
    try {
      const next = await fn();
      onChanged(next);
      return next;
    } catch (e) {
      if (isUnavailable(e)) setUnavailable(officialBotError(e));
      else setError(officialBotError(e));
      return null;
    } finally {
      setBusy(false);
    }
  };
  const toggle = (on: boolean) => void run(() => updateOfficialBot(engine, orgId, key, { enabled: on }));
  const save = async () => {
    setSaved(false);
    const clean = cleanSettings(key, draft);
    const problem = settingsProblem(key, clean, botsPlus);
    if (problem) return setError(problem);
    const needs = plusNeeded(key, original, clean, botsPlus);
    if (needs.length) return setError(`Those changes need Bots+ (${needs.join(", ")}).`);
    const next = await run(() => updateOfficialBot(engine, orgId, key, { settings: changedSettings(original, clean) }));
    if (!next) return;
    const fresh = settingsDraft(key, next.settings);
    setOriginal(fresh);
    setDraft(fresh);
    setSaved(true);
  };

  const header = (
    <div className="obot-head" style={{ "--obot": catalog.color } as CSSProperties}>
      <BotIcon bot={bot} catalog={catalog} size={56} />
      <span className="lines grow">
        <h2>
          {bot?.look.displayName ?? catalog.name} <BotTag />
        </h2>
        <small>{catalog.tagline}</small>
      </span>
      {canEdit && (
        <span className="obot-switch">
          <small>{enabled ? "On" : "Off"}</small>
          <Toggle checked={enabled} disabled={busy || unavailable !== null} onChange={toggle} label={`${catalog.name} on`} />
        </span>
      )}
      <button className="icon-btn" onClick={onClose} aria-label="Close">
        <X size={18} />
      </button>
    </div>
  );
  const settingsShown = hasSettings(key) && (canEdit || unavailable !== null);
  const footer =
    hasSettings(key) && canEdit && unavailable === null ? (
      <>
        {error && (
          <small className="field-error grow" role="alert">
            {error}
          </small>
        )}
        <span className="grow" />
        <button type="button" className="btn btn-primary" disabled={busy || !dirty} onClick={() => void save()}>
          {busy ? (
            "Saving…"
          ) : !dirty && saved ? (
            <>
              <Check size={15} /> Saved
            </>
          ) : (
            "Save"
          )}
        </button>
      </>
    ) : undefined;

  return (
    <Dialog title={catalog.name} onClose={onClose} header={header} footer={footer} className="obot-window" wide>
      <div className="obot-body">
        {unavailable && (
          <div className="banner warn" role="note">
            <Clock size={15} aria-hidden="true" /> {unavailable}
          </div>
        )}
        {!footer && error && <div className="banner danger">{error}</div>}
        <p>{catalog.description}</p>
        {canEdit && diagnosticsOn && <BotDiagnostics key={bot?.updatedAt ?? "new"} orgId={orgId} botKey={key} />}
        {catalog.features.length > 0 && (
          <div className="obot-chips">
            {catalog.features.map((f) => (
              <span key={f} className="obot-chip">
                {f}
              </span>
            ))}
          </div>
        )}
        {catalog.sample && <SampleMessage bot={bot} catalog={catalog} />}
        {catalog.commands.length > 0 && (
          <section className="obot-section" aria-label="Commands">
            <h4>Commands</h4>
            <dl className="obot-commands">
              {catalog.commands.map((c) => (
                <div key={c.usage}>
                  <dt>
                    <code>{c.usage}</code>
                  </dt>
                  <dd>{c.description}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
        {bot && enabled && <BotLook orgId={orgId} bot={bot} catalog={catalog} canEdit={canEdit} onChanged={onChanged} />}
        {settingsShown && (
          <section className="obot-section" aria-label="Settings">
            <h4>Settings</h4>
            <fieldset className="obot-settings" disabled={readOnly}>
              <BotSettingsForm
                botKey={key as Parameters<typeof BotSettingsForm>[0]["botKey"]}
                draft={draft}
                set={(patch) => {
                  setSaved(false);
                  setDraft((d) => ({ ...d, ...patch }));
                }}
                botsPlus={botsPlus}
                paused={bot?.plusPaused ?? []}
                channels={channels}
                roles={givable}
                ctx={{ orgId, orgName, memberCount, enabled, dirty }}
              />
            </fieldset>
          </section>
        )}
        {key === "tickets" && canEdit && ticketsOn && unavailable === null && <TicketsCard key={String(enabled)} orgId={orgId} hideSwitch />}
        {key === "alerts" && canEdit && unavailable === null && <AlertsWatches orgId={orgId} channels={channels} roles={givable} botsPlus={botsPlus} />}
        {!canEdit && <p className="faint">Only people who can edit this community turn bots on and change them.</p>}
        {!botsPlus && catalog.limits.length > 0 && <PlusUpsell perks={perks} orgId={orgId} />}
        <FreePlusTable limits={catalog.limits} />
      </div>
    </Dialog>
  );
}

/** What the bot says, drawn like a message from it. */
function SampleMessage({ bot, catalog }: { bot: OfficialBot | null; catalog: CatalogBot }) {
  return (
    <div className="obot-sample" aria-label="Sample message">
      <BotIcon bot={bot} catalog={catalog} size={36} />
      <span className="lines grow">
        <span>
          <strong>{bot?.look.displayName ?? catalog.name}</strong> <BotTag /> <small className="faint">Today</small>
        </span>
        <span className="obot-sample-text">{catalog.sample}</span>
      </span>
    </div>
  );
}
