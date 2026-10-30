import { useCallback, useState } from "react";
import { ApiError } from "../../../api/client";
import { isBillingUnavailable, safeCheckoutUrl } from "../../../sync/discovery/promote";

export interface PromoteBuy {
  /** Which button is waiting for the server ("boost:mega", "promoted"). */
  busy: string | null;
  /** Set once the server says it takes no payments yet: the page shows "Coming soon" instead of an error. */
  comingSoon: boolean;
  error: string | null;
  buy: (key: string, checkout: () => Promise<string>) => Promise<void>;
}

/**
 * A Promote button: asks the server for a checkout page and goes there. While Meldiq takes no payments the server answers
 * 503 billing_unavailable; the buttons stay and the page says payments are being set up.
 */
export function usePromoteBuy(): PromoteBuy {
  const [busy, setBusy] = useState<string | null>(null);
  const [comingSoon, setComingSoon] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const buy = useCallback(async (key: string, checkout: () => Promise<string>) => {
    setBusy(key);
    setError(null);
    try {
      const url = safeCheckoutUrl(await checkout());
      if (!url) throw new Error("The checkout page's address isn't one Meldiq opens.");
      window.location.assign(url);
    } catch (e) {
      if (isBillingUnavailable(e)) setComingSoon(true);
      else setError(e instanceof ApiError || e instanceof Error ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(null);
    }
  }, []);
  return { busy, comingSoon, error, buy };
}
