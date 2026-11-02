import { BadgeMark } from "../components/BadgeMark";

/**
 * The Mojo badge next to a name (server docs/MOJO.md): GO or PLUS, and for Plus the Meldiq Check. Decorative to screen
 * readers except for its label; it grants nothing and says nothing about identity.
 */
export function MojoBadgeMark({ badge, check }: { badge: "go" | "plus"; check: boolean }) {
  const label = badge === "plus" ? (check ? "Mojo Plus member, with Meldiq Check (a Plus perk, not verification)" : "Mojo Plus member") : "Mojo Go member";
  return (
    <BadgeMark className={`mojo-badge mojo-badge-${badge}`} name={badge === "plus" ? "Mojo Plus" : "Mojo Go"} description={label}>
      <svg width="16" height="18" viewBox="0 0 20 22" fill="none" aria-hidden="true">
        <path d="m10 1 8 5v10l-8 5-8-5V6l8-5Z" fill="currentColor" opacity=".17" />
        <path d="m10 1 8 5v10l-8 5-8-5V6l8-5Z" stroke="currentColor" strokeWidth="1.5" />
        {check ? (
          <path d="m6 11 3 3 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="m10 5 1.5 4.5L16 11l-4.5 1.5L10 17l-1.5-4.5L4 11l4.5-1.5L10 5Z" fill="currentColor" />
        )}
      </svg>
    </BadgeMark>
  );
}
