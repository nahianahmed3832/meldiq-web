import { BadgeCheck } from "lucide-react";

/**
 * The Mojo badge next to a name (server docs/MOJO.md): GO or PLUS, and for Plus the Meldiq Check. Decorative to screen
 * readers except for its label; it grants nothing and says nothing about identity.
 */
export function MojoBadgeMark({ badge, check }: { badge: "go" | "plus"; check: boolean }) {
  const label = badge === "plus" ? (check ? "Mojo Plus member, with Meldiq Check (a Plus perk, not verification)" : "Mojo Plus member") : "Mojo Go member";
  return (
    <span className={`mojo-badge mojo-badge-${badge}`} title={label} aria-label={label} role="img">
      {badge === "plus" ? "PLUS" : "GO"}
      {check && <BadgeCheck size={12} aria-hidden="true" />}
    </span>
  );
}
