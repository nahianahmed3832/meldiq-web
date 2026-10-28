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
      const url = await engine.mojo.buySparks(quantity);
      if (url) window.location.assign(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open the payment page. Nothing was charged.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mojo">
      <h1>Meldiq Spark</h1>
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
              Try again
            </button>
          </div>
        ) : (
          <div className="mojo-loading" role="status">
            <Loader2 size={18} className="spin" aria-hidden="true" /> Loading Meldiq Spark…
          </div>
        )
      ) : (
        <SparkSection onBuy={(q) => void buy(q)} busy={busy} offline={!online} />
      )}
    </div>
  );
}
