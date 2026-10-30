import type { BotSettingsMap, SettingsKey } from "../../../sync/officialBotRules";
import type { PanelChannel } from "../../../sync/communityRules";
import type { Role } from "../../../sync/roles";

/** What a bot's window knows that its settings form needs. */
export interface BotFormContext {
  orgId: string;
  orgName: string;
  memberCount: number;
  /** The bot is on (a test message needs it). */
  enabled: boolean;
  /** There are unsaved changes (a test uses what's saved). */
  dirty: boolean;
}

export interface BotFormProps<K extends SettingsKey> {
  draft: BotSettingsMap[K];
  set: (patch: Partial<BotSettingsMap[K]>) => void;
  botsPlus: boolean;
  /** Plus fields kept but not applied (Bots+ ended). */
  paused: readonly string[];
  /** The community's text channels. */
  channels: PanelChannel[];
  /** Roles a bot could give or ping (not archived). */
  roles: Role[];
  ctx: BotFormContext;
}
