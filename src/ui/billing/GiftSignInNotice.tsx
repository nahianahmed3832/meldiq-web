import { useMemo } from "react";
import { ApiClient } from "../../api/client";
import { apiBase } from "../../application/config";
import { giftTokenFromLocation, zGiftPreview } from "../../api/giftSchemas";
import { useLoad } from "../workspace/useLoad";

/** The claim stays in the fragment while signing in. No gift is redeemed by previewing it. */
export function GiftSignInNotice() {
  const token = giftTokenFromLocation();
  const api = useMemo(() => new ApiClient(apiBase()), []);
  const preview = useLoad(() => (token ? api.json("POST", "/v2/billing/gifts/preview", zGiftPreview, { auth: false, body: { token } }) : Promise.resolve(null)), [api, token]);
  if (!token) return null;
  return (
    <aside className="banner" aria-label="Your Meldiq gift">
      {preview.loading ? (
        "Checking your gift…"
      ) : preview.error ? (
        <span role="alert">{preview.error}</span>
      ) : (
        preview.data && (
          <>
            <strong>
              {preview.data.sender ?? "A friend"} sent you {preview.data.months} month{preview.data.months === 1 ? "" : "s"} of Plus.
            </strong>
            <p>Sign in or create a Meldiq account to redeem your paid gift. No payment is needed.{preview.data.requiresVerifiedEmail ? " Use the email that received the gift." : ""}</p>
          </>
        )
      )}
    </aside>
  );
}
