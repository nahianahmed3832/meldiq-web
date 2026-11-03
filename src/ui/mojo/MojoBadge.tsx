import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { BadgeMark } from "../components/BadgeMark";
/**
 * Explicit membership wordmarks, coloured by the current theme. A subscription never looks like verification.
 */
export function MojoBadgeMark({ badge }: { badge: "go" | "plus"; check: boolean }) {
  useLocaleRender();
  const label = badge === "plus" ? uiText("billing.interface.meldiq_plus_membership_b041ba3") : uiText("billing.interface.legacy_go_membership_0a93b12");
  return (
    <BadgeMark className={`mojo-badge mojo-badge-${badge}`} name={badge === "plus" ? "Meldiq Plus" : "Legacy Go"} description={label}>
      <span className="membership-wordmark">{badge === "plus" ? uiText("billing.interface.plus_507391f") : "GO"}</span>
    </BadgeMark>
  );
}
