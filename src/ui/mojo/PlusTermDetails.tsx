import type { PlusTerm } from "../../api/mojoSchemas";
import { text } from "../../i18n";
import { formatUnit } from "../../i18n/format";
import { Localized } from "../../i18n/Localized";
import { money } from "./mojoFormat";

export function plusTermLabel(months: number): string {
  return months === 1 ? text("billing.monthly") : formatUnit(months, "month");
}

export function PlusTermDetails({ term, price }: { term: PlusTerm; price: { amountMinor: number; currency: string } | null }) {
  const shown = price ?? term;
  return (
    <span>
      <strong>{plusTermLabel(term.months)}</strong>
      <small>
        <Localized
          k="billing.interface.billed_every_45e2ceb"
          slots={[money(shown.amountMinor, shown.currency), term.months === 1 ? text("billing.interface.month_a5c7d17") : formatUnit(term.months, "month")]}
        />
      </small>
      {term.savingsMinor > 0 && (
        <small className="plus-term-saving">
          <Localized
            k="billing.interface.vs_monthly_about_month_fc2ea2d"
            slots={[text("common.actions.save"), money(term.savingsMinor, term.currency), term.savingsPercent, money(term.monthlyEquivalentMinor, term.currency)]}
          />
        </small>
      )}
      {!price && (
        <small>
          <Localized k="billing.interface.not_available_for_purchase_yet_fda50e8" />
        </small>
      )}
    </span>
  );
}
