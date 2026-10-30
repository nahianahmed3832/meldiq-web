import { z } from "zod";
import type { Engine } from "../engine";
import { communityOfficialBots, updateOfficialBot } from "../officialBots";
import { saveTicketsConfig, ticketsConfig } from "./api";
import type { PanelDraft } from "./tickets";

/**
 * Tickets settings from either side (community parity C and D part 2): on a server with official bots, the Tickets
 * bot's settings are the tickets config plus its Bots+ extras (support role, welcome line, transcripts) and its switch
 * is the tickets switch; elsewhere batch C's /tickets/config alone. The screens use one shape for both.
 */

export const TICKET_LIMITS = { panels: { free: 2, plus: 10 }, maxOpen: { free: 3, plus: 10 }, welcome: 500 } as const;

export interface TicketsState {
  enabled: boolean;
  maxOpenPerPerson: number;
  panels: PanelDraft[];
  /** Plus: a transcript in the panel's log channel when a ticket closes. */
  transcripts: boolean;
  /** Through the Tickets bot: the Plus extras exist on this server. */
  viaBot: boolean;
  botsPlus: boolean;
  panelLimit: number;
  maxOpenLimit: number;
  /** Plus settings kept but not applied (Bots+ ended). */
  paused: string[];
}

const nullableString = z
  .string()
  .nullish()
  .transform((v) => v ?? null);
const zBotPanel = z.object({
  id: z.string(),
  name: z.string(),
  postChannelId: nullableString,
  categoryId: nullableString,
  logChannelId: nullableString,
  supportRoleId: nullableString,
  welcomeMessage: nullableString,
  postedMessageId: nullableString,
});
const zBotSettings = z.object({ maxOpenPerPerson: z.number().int(), panels: z.array(zBotPanel), transcripts: z.boolean().default(false) });

const draftOf = (p: z.infer<typeof zBotPanel>): PanelDraft => ({
  id: p.id,
  name: p.name,
  postChannelId: p.postChannelId ?? "",
  categoryId: p.categoryId,
  logChannelId: p.logChannelId,
  supportRoleId: p.supportRoleId,
  welcomeMessage: p.welcomeMessage,
  postedMessageId: p.postedMessageId,
});

/** Loads the tickets settings, through the Tickets bot when [viaBot]. */
export async function loadTickets(engine: Engine, orgId: string, viaBot: boolean): Promise<TicketsState> {
  if (viaBot) {
    const view = await communityOfficialBots(engine, orgId);
    const bot = view.bots.find((b) => b.key === "tickets");
    const parsed = bot?.available ? zBotSettings.safeParse(bot.settings) : null;
    if (bot && parsed?.success) {
      const plus = view.botsPlus;
      return {
        enabled: bot.enabled,
        maxOpenPerPerson: parsed.data.maxOpenPerPerson,
        panels: parsed.data.panels.map(draftOf),
        transcripts: parsed.data.transcripts,
        viaBot: true,
        botsPlus: plus,
        panelLimit: plus ? TICKET_LIMITS.panels.plus : TICKET_LIMITS.panels.free,
        maxOpenLimit: plus ? TICKET_LIMITS.maxOpen.plus : TICKET_LIMITS.maxOpen.free,
        paused: bot.plusPaused,
      };
    }
  }
  const c = await ticketsConfig(engine, orgId);
  return {
    enabled: c.enabled,
    maxOpenPerPerson: c.maxOpenPerPerson,
    panels: c.panels.map((p) => draftOf({ ...p, supportRoleId: null, welcomeMessage: null })),
    transcripts: false,
    viaBot: false,
    botsPlus: false,
    panelLimit: c.panelLimit,
    maxOpenLimit: c.panelLimit > TICKET_LIMITS.panels.free ? TICKET_LIMITS.maxOpen.plus : TICKET_LIMITS.maxOpen.free,
    paused: [],
  };
}

const panelBody = (p: PanelDraft, extras: boolean) => ({
  ...(p.id ? { id: p.id } : {}),
  name: p.name.trim(),
  postChannelId: p.postChannelId,
  categoryId: p.categoryId,
  logChannelId: p.logChannelId,
  // Without Bots+ the extras can't be sent (403): saving the panels then leaves them out.
  ...(extras ? { supportRoleId: p.supportRoleId ?? null, welcomeMessage: p.welcomeMessage?.trim() || null } : {}),
});

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Saves what changed between [before] and [next]; answers the settings as stored. */
export async function saveTickets(engine: Engine, orgId: string, before: TicketsState, next: TicketsState): Promise<TicketsState> {
  if (!before.viaBot) {
    await saveTicketsConfig(engine, orgId, { enabled: next.enabled, maxOpenPerPerson: next.maxOpenPerPerson, panels: next.panels.map((p) => panelBody(p, false)) });
    return loadTickets(engine, orgId, false);
  }
  const settings: Record<string, unknown> = {};
  if (next.maxOpenPerPerson !== before.maxOpenPerPerson) settings.maxOpenPerPerson = next.maxOpenPerPerson;
  if (!same(next.panels, before.panels)) settings.panels = next.panels.map((p) => panelBody(p, next.botsPlus));
  if (next.transcripts !== before.transcripts) settings.transcripts = next.transcripts;
  if (Object.keys(settings).length) await updateOfficialBot(engine, orgId, "tickets", { settings });
  if (next.enabled !== before.enabled) await updateOfficialBot(engine, orgId, "tickets", { enabled: next.enabled });
  await engine.refreshAll();
  return loadTickets(engine, orgId, true);
}
