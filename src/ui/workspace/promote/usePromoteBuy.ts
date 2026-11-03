import { text as uiText } from "../../../i18n";
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
      if (!url) throw new Error(uiText("workspace.interface.the_checkout_page_s_address_isn_t_one_meldiq_opens_1199238"));
      window.location.assign(url);
    } catch (e) {
      if (isBillingUnavailable(e)) setComingSoon(true);
      else setError(e instanceof ApiError || e instanceof Error ? e.message : uiText("workspace.interface.that_didn_t_work_try_again_5da2573"));
    } finally {
      setBusy(null);
    }
  }, []);
  return { busy, comingSoon, error, buy };
}
