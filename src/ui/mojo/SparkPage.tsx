import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { navigate } from "../../application/router";
import { selectCheckout } from "../billing/checkoutDraft";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { SparkSection } from "./SparkSection";
/**
 * Settings › Meldiq Spark (the owner's request, 2026-10-28: its own page, apart from the plans): the levels, your
 * Sparks and where each one is, and buying more. Giving one to a community is also on that community's own Spark goal
 * and menu (SparkDialog).
 */
export function SparkPage() {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const mojo = useOrbit((s) => s.mojo);
  const online = useOrbit((s) => s.connection === "online");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void engine.mojo.refresh();
  }, [engine]);
  const buy = async (quantity: number) => {
    setBusy(true);
    setError(null);
    try {
      if (mojo.billing?.provider === "paypal") {
        selectCheckout(engine.device.userId, { product: "spark", quantity });
        navigate({ section: "settings", settingsPage: "checkout" });
        return;
      }
      const url = await engine.mojo.buySparks(quantity);
      if (url) window.location.assign(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : uiText("billing.interface.couldn_t_open_the_payment_page_nothing_was_charged_679d717"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mojo">
      <h1>{l10n("settings.settings_spark")}</h1>
      {error && (
        <div className="banner danger" role="alert">
          {error}
        </div>
      )}
      {!mojo.catalog || !mojo.me ? (
        mojo.error ? (
          <div className="banner danger" role="alert">
            <span className="grow">{mojo.error}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => void engine.mojo.refresh()}>
              {l10n("common.actions.retry")}
            </button>
          </div>
        ) : (
          <div className="mojo-loading" role="status">
            <Localized k="billing.interface.loading_meldiq_spark_b59ace7" slots={[<Loader2 size={18} className="spin" aria-hidden="true" />]} />
          </div>
        )
      ) : (
        <SparkSection onBuy={(q) => void buy(q)} busy={busy} offline={!online} />
      )}
    </div>
  );
}
