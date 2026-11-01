import { type CSSProperties, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "../people/ProfileStyle";
/** A still snapshot when motion is reduced: CSS alone cannot stop animated image formats. */
export function MotionImage({ src, alt, className, style, title }: { src: string; alt: string; className?: string; style?: CSSProperties; title?: string }) {
  const reduced = useReducedMotion();
  return reduced ? (
    <StillImage key={src} src={src} alt={alt} className={className} style={style} title={title} />
  ) : (
    <img src={src} alt={alt} className={className} style={style} title={title} draggable={false} />
  );
}
function StillImage({ src, alt, className, style, title }: { src: string; alt: string; className?: string; style?: CSSProperties; title?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    const image = new Image();
    image.onload = () => {
      const node = canvas.current;
      if (!alive || !node) return;
      const scale = Math.min(1, 640 / image.naturalWidth, 640 / image.naturalHeight);
      node.width = Math.max(1, Math.round(image.naturalWidth * scale));
      node.height = Math.max(1, Math.round(image.naturalHeight * scale));
      try {
        const ctx = node.getContext("2d");
        if (ctx) {
          ctx.drawImage(image, 0, 0, node.width, node.height);
          setReady(true);
        }
      } catch {
        setReady(false);
      }
    };
    image.src = src;
    return () => {
      alive = false;
      image.onload = null;
      image.src = "";
    };
  }, [src]);
  return (
    <>
      <canvas
        ref={canvas}
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        aria-hidden={!alt || !ready}
        className={className}
        title={title}
        style={{ ...style, display: ready ? style?.display : "none" }}
      />
      {!ready && alt && <span>{alt}</span>}
    </>
  );
}
