import { afterEach, expect, test, vi } from "vitest";
import { ApiClient } from "../src/api/client";
import { fetchPayPalCheckoutConfig } from "../src/ui/billing/checkoutConfig";

afterEach(() => vi.unstubAllGlobals());

test.each([
  ["web.meldiq.app", "sandbox", false],
  ["web.meldiq.app", "live", true],
  ["localhost", "sandbox", true],
] as const)("checkout config on %s with %s PayPal", async (hostname, environment, allowed) => {
  vi.stubGlobal("window", { location: { hostname } });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ provider: "paypal", clientId: "public-id", environment, subscriptions: true, cards: false })),
  );

  const config = fetchPayPalCheckoutConfig(new ApiClient(""));
  if (allowed) await expect(config).resolves.toMatchObject({ environment });
  else await expect(config).rejects.toThrow("PayPal checkout is not available");
});
