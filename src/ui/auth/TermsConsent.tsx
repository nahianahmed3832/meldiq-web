import { Localized } from "../../i18n/Localized";
import { useT } from "../../i18n";
import type { RegistrationPolicy } from "../../auth/registrationPolicy";

/** Shared explicit consent for registration and first identity setup after provider sign-in. */
export function TermsConsent({
  id,
  accepted,
  onChange,
  disabled = false,
  policy,
}: {
  id: string;
  accepted: boolean;
  onChange: (accepted: boolean) => void;
  disabled?: boolean;
  policy?: RegistrationPolicy | null;
}) {
  const t = useT();
  return (
    <div className="auth-consent">
      <input id={id} type="checkbox" required checked={accepted} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <label htmlFor={id}>
        <Localized
          k="auth.foundation.acceptTerms"
          slots={[
            <a key="terms" href={policy?.terms.url ?? "https://meldiq.app/legal/terms"} target="_blank" rel="noopener noreferrer">
              {t("landing_terms")}
              {policy && (
                <>
                  {" "}
                  (<bdi>{policy.terms.revision}</bdi>)
                </>
              )}
            </a>,
            <a key="privacy" href={policy?.privacy.url ?? "https://meldiq.app/legal/privacy"} target="_blank" rel="noopener noreferrer">
              {t("landing_privacy")}
              {policy && (
                <>
                  {" "}
                  (<bdi>{policy.privacy.revision}</bdi>)
                </>
              )}
            </a>,
          ]}
        />
      </label>
    </div>
  );
}
