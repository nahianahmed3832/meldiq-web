import { BadgeMark } from "../components/BadgeMark";

/**
 * The Mojo badge next to a name (server docs/MOJO.md): GO or PLUS, and for Plus the Meldiq Check. Decorative to screen
 * readers except for its label; it grants nothing and says nothing about identity.
 */
export function MojoBadgeMark({ badge, check }: { badge: "go" | "plus"; check: boolean }) {
  const label = badge === "plus" ? (check ? "Mojo Plus member, with Meldiq Check (a Plus perk, not verification)" : "Mojo Plus member") : "Mojo Go member";
  return (
    <BadgeMark className={`mojo-badge mojo-badge-${badge}`} name={badge === "plus" ? "Mojo Plus" : "Mojo Go"} description={label}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        {badge === "plus" ? (
          <path d="m12 1 2.6 2.3 3.4-.1 1 3.3 2.8 2-1.1 3.3 1.1 3.3-2.8 2-1 3.3-3.4-.1L12 23l-2.6-2.3-3.4.1-1-3.3-2.8-2L3.3 12 2.2 8.7l2.8-2 1-3.3 3.4.1L12 1Z" fill="currentColor" />
        ) : (
          <path d="m12 2 3.1 6.3 7 .9-5.1 5 1.2 7-6.2-3.3-6.2 3.3 1.2-7-5.1-5 7-.9L12 2Z" fill="currentColor" />
        )}
        {check && badge === "plus" ? (
          <path d="m7.5 12 3 3 6-6" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="m12 7 1.3 3.7L17 12l-3.7 1.3L12 17l-1.3-3.7L7 12l3.7-1.3L12 7Z" fill="white" opacity=".85" />
        )}
      </svg>
    </BadgeMark>
  );
}
