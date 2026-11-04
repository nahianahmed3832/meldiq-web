import { Bell, Compass, House, MessagesSquare } from "lucide-react";
import type { Section } from "../../application/router";
import type { MessageKey } from "../../i18n";

/** Daily destinations, shared by desktop navigation and mobile tabs. */
export const PRIMARY_NAVIGATION = [
  { section: "home", labelKey: "nav_home", icon: House, sections: ["home", "lobby", "workspace"] },
  { section: "dms", labelKey: "nav_messages", icon: MessagesSquare, sections: ["dms", "friends"] },
  { section: "activity", labelKey: "nav_activity", icon: Bell, sections: ["activity"] },
  { section: "discover", labelKey: "workspace.rail_communities", icon: Compass, sections: ["discover"] },
] as const satisfies readonly { section: Section; labelKey: MessageKey; icon: typeof House; sections: readonly Section[] }[];

export function primaryDestinationActive(destination: (typeof PRIMARY_NAVIGATION)[number], section: Section): boolean {
  return (destination.sections as readonly Section[]).includes(section);
}
