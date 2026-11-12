import { useState } from "react";
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
  const privacyUrl = policy?.privacy.url ?? "https://meldiq.app/legal/privacy";
  const privacyVersion = JSON.stringify([privacyUrl, policy?.privacy.revision]);
  const [openedVersion, setOpenedVersion] = useState<string | null>(null);
  const opened = openedVersion === privacyVersion;
  const openPrivacy = () => setOpenedVersion(privacyVersion);
  return (
    <div className="auth-consent">
      <input
        id={id}
        type="checkbox"
        required
        checked={accepted && opened}
        disabled={disabled || !opened}
        aria-describedby={opened ? undefined : `${id}-privacy-hint`}
        onChange={(event) => onChange(event.target.checked)}
      />
      <div>
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
              <a
                key="privacy"
                id={`${id}-privacy`}
                href={privacyUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={openPrivacy}
                onAuxClick={(event) => {
                  if (event.button === 1) openPrivacy();
                }}
              >
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
        {!opened && (
          <div id={`${id}-privacy-hint`} className="muted">
            {t("auth.foundation.openPrivacyFirst")}
          </div>
        )}
      </div>
    </div>
  );
}
