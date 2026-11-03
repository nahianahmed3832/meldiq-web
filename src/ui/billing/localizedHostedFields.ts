import { translate } from "../../i18n/runtime";
import { directionOf, type Language } from "../../i18n/languages";

const labels = ["billing.interface.name_on_card_18bf091", "billing.interface.card_number_816fca1", "billing.interface.expiration_date_8ccc3fd", "billing.interface.security_code_1259260"] as const;

/** Update the existing hosted controls' accessibility context without replacing a field or clearing entered data. */
export function updateHostedFieldLanguage(fields: readonly HTMLElement[], language: Language): void {
  fields.forEach((field, index) => {
    const key = labels[index];
    if (!key) return;
    field.setAttribute("aria-label", translate(language, key));
    if (index < 2) field.setAttribute("placeholder", translate(language, key));
    field.lang = language;
    field.dir = directionOf(language);
  });
}
