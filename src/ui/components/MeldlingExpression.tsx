import { MELDLING_ASSETS } from "../../application/brand";

/** The canonical mascot carries the expression; the small symbol keeps its meaning recognizable. */
export function MeldlingExpression({ symbol }: { symbol: string }) {
  return (
    <span className="meldling-expression" aria-hidden="true">
      <img src={MELDLING_ASSETS.mark} width={128} height={128} alt="" draggable={false} />
      <span className="meldling-expression-symbol">{symbol}</span>
    </span>
  );
}
