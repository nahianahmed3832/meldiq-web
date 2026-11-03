import { formatUnit } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useMemo } from "react";
import { ApiClient } from "../../api/client";
import { apiBase } from "../../application/config";
import { giftTokenFromLocation, zGiftPreview } from "../../api/giftSchemas";
import { useLoad } from "../workspace/useLoad";
/** The claim stays in the fragment while signing in. No gift is redeemed by previewing it. */
export function GiftSignInNotice() {
  useLocaleRender();
  const token = giftTokenFromLocation();
  const api = useMemo(() => new ApiClient(apiBase()), []);
  const preview = useLoad(() => (token ? api.json("POST", "/v2/billing/gifts/preview", zGiftPreview, { auth: false, body: { token } }) : Promise.resolve(null)), [api, token]);
  if (!token) return null;
  return (
    <aside className="banner" aria-label={uiText("billing.interface.your_meldiq_gift_2761ec1")}>
      {preview.loading ? (
        uiText("billing.interface.checking_your_gift_5295c26")
      ) : preview.error ? (
        <span role="alert">{preview.error}</span>
      ) : (
        preview.data && (
          <>
            <strong>
              <Localized k="billing.interface.native_count_f9092cfad" slots={[preview.data.sender ?? uiText("billing.interface.a_friend_6c274d2"), formatUnit(preview.data.months, "month"), ""]} />
            </strong>
            <p>
              <Localized
                k="billing.interface.sign_in_or_create_a_meldiq_account_to_redeem_your_paid_gift_no_pa_22caf29"
                slots={[preview.data.requiresVerifiedEmail ? uiText("billing.interface.use_the_email_that_received_the_gift_fcc4317") : ""]}
              />
            </p>
          </>
        )
      )}
    </aside>
  );
}
