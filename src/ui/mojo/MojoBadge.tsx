import { BadgeMark } from "../components/BadgeMark";

/**
 * Explicit membership wordmarks, coloured by the current theme. A subscription never looks like verification.
 */
export function MojoBadgeMark({ badge }: { badge: "go" | "plus"; check: boolean }) {
  const label = badge === "plus" ? "Meldiq Plus membership" : "Legacy Go membership";
  return (
    <BadgeMark className={`mojo-badge mojo-badge-${badge}`} name={badge === "plus" ? "Meldiq Plus" : "Legacy Go"} description={label}>
      <span className="membership-wordmark">{badge === "plus" ? "PLUS" : "GO"}</span>
    </BadgeMark>
  );
}
