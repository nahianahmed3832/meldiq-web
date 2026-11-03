import { interfaceLocale } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { Localized } from "../../i18n/Localized";
/** Only sent to PayPal's hosted SDK; card details and billing address never pass through Meldiq's API. */
const codes =
  "AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(
    " ",
  );
export function CardBillingAddress({
  country,
  postal,
  onCountry,
  onPostal,
  disabled,
}: {
  country: string;
  postal: string;
  onCountry: (v: string) => void;
  onPostal: (v: string) => void;
  disabled?: boolean;
}) {
  useLocaleRender();
  const locale = interfaceLocale();
  const names = new Intl.DisplayNames([locale], { type: "region" });
  const countries = codes.map((code) => ({ code, name: names.of(code) ?? code })).sort((a, b) => a.name.localeCompare(b.name, locale));
  return (
    <div className="checkout-card-field-row">
      <label>
        <Localized k="billing.interface.billing_country_39ea784" />
        <select className="input" autoComplete="country" value={country} onChange={(e) => onCountry(e.target.value)} disabled={disabled}>
          <option value="">
            <Localized k="billing.interface.choose_country_6b3ed4d" />
          </option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <Localized k="billing.interface.postal_code_if_applicable_6312b20" />
        <input className="input" autoComplete="postal-code" maxLength={20} value={postal} onChange={(e) => onPostal(e.target.value)} disabled={disabled} />
      </label>
    </div>
  );
}
