import type { IconName } from "../icons/Icon";
import type { Section } from "../../application/router";
import type { MessageKey } from "../../i18n";

/** Daily destinations, shared by desktop navigation and mobile tabs. */
export const PRIMARY_NAVIGATION = [
  { section: "home", labelKey: "nav_home", icon: "navigation.home", sections: ["home", "lobby", "workspace"] },
  { section: "dms", labelKey: "nav_messages", icon: "navigation.messages", sections: ["dms", "friends"] },
  { section: "activity", labelKey: "nav_activity", icon: "navigation.activity", sections: ["activity"] },
  { section: "discover", labelKey: "workspace.rail_communities", icon: "navigation.discover", sections: ["discover"] },
] as const satisfies readonly { section: Section; labelKey: MessageKey; icon: IconName; sections: readonly Section[] }[];

export function primaryDestinationActive(destination: (typeof PRIMARY_NAVIGATION)[number], section: Section): boolean {
  return (destination.sections as readonly Section[]).includes(section);
}
