import type { ApiClient } from "../../api/client";
import { zPayPalConfig } from "../../api/paypalSchemas";
import { text } from "../../i18n";

export async function fetchPayPalCheckoutConfig(api: ApiClient) {
  const config = await api.json("GET", "/v2/billing/paypal/config", zPayPalConfig);
  // A misconfigured production API must never open a sandbox payment window.
  if (window.location.hostname === "web.meldiq.app" && config.environment !== "live") {
    throw new Error(text("billing.interface.paypal_checkout_is_not_available_on_this_server_yet_73c03ac"));
  }
  return config;
}
