import qrcode from "qrcode-generator";
import { useMemo } from "react";

/**
 * A QR code drawn as an SVG from its modules (no HTML strings), dark on white so phones read it in either theme
 * (android qrBitmap). [text] is what a phone's scanner gets, e.g. an invite link.
 */
export function QrCode({ text, size = 176, label }: { text: string; size?: number; label: string }) {
  const { count, path } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return { count: n, path: d };
  }, [text]);
  const margin = 2;
  const box = count + margin * 2;
  return (
    <svg className="qr-code" width={size} height={size} viewBox={`${-margin} ${-margin} ${box} ${box}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect x={-margin} y={-margin} width={box} height={box} fill="#fff" />
      <path d={path} fill="#13221f" />
    </svg>
  );
}
