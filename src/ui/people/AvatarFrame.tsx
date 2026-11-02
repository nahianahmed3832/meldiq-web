import { useId } from "react";

const MATERIALS: Record<string, [string, string, string]> = {
  aurora: ["#67e8f9", "#a78bfa", "#f0abfc"],
  ember: ["#fde68a", "#fb923c", "#ef4444"],
  frost: ["#f0f9ff", "#7dd3fc", "#818cf8"],
  neon: ["#f0abfc", "#c084fc", "#22d3ee"],
  sakura: ["#fff1f2", "#f9a8d4", "#fb7185"],
  pixel: ["#d9f99d", "#34d399", "#22d3ee"],
};

/** Original vector frames: a clear centre for the photo, with ornament outside its edge. */
export function AvatarFrame({ kind }: { kind: string }) {
  const id = useId().replace(/:/g, "");
  const colors = MATERIALS[kind] ?? MATERIALS.aurora;
  return (
    <svg viewBox="0 0 120 120" fill="none" aria-hidden="true" className="avatar-frame-art">
      <defs>
        <linearGradient id={id} x1="12" y1="12" x2="108" y2="108" gradientUnits="userSpaceOnUse">
          <stop stopColor={colors[0]} />
          <stop offset=".5" stopColor={colors[1]} />
          <stop offset="1" stopColor={colors[2]} />
        </linearGradient>
      </defs>
      <g stroke={`url(#${id})`}>
        <circle cx="60" cy="60" r="51" strokeWidth="2.5" />
        <circle cx="60" cy="60" r="55" strokeWidth=".75" opacity=".5" strokeDasharray={kind === "pixel" ? "5 4" : "22 8 2 8"} />
      </g>
      <g fill={`url(#${id})`}>
        {kind === "sakura" ? (
          [25, 150, 225].map((angle) => (
            <g key={angle} transform={`rotate(${angle} 60 60) translate(60 7)`}>
              {[0, 72, 144, 216, 288].map((a) => (
                <ellipse key={a} cy="-4" rx="3.5" ry="5.5" transform={`rotate(${a})`} />
              ))}
              <circle r="2" fill="#fff7ed" />
            </g>
          ))
        ) : kind === "frost" ? (
          [40, 175, 280].map((angle) => (
            <g key={angle} transform={`rotate(${angle} 60 60) translate(60 7)`} stroke={colors[0]} strokeWidth="1.5" strokeLinecap="round">
              <path d="M0-7V7M-6-3.5 6 3.5M-6 3.5 6-3.5M-2-5 0-3 2-5M-2 5 0 3 2 5" />
            </g>
          ))
        ) : kind === "ember" ? (
          <>
            <path d="M14 43C4 35 17 24 14 16c13 9 15 19 8 26l-4-9Z" />
            <path d="M96 89c12-6 8-17 15-23 2 15-1 27-13 29l4-12Z" />
            <path d="m34 108 3-7 3 7-3 6ZM90 12l2-6 2 6-2 4Z" />
          </>
        ) : kind === "pixel" ? (
          <>
            <path d="M17 17h13v5h-8v8h-5ZM90 17h13v13h-5v-8h-8ZM17 90h5v8h8v5H17ZM98 90h5v13H90v-5h8Z" />
            <path d="M57 3h6v6h-6ZM3 57h6v6H3ZM111 57h6v6h-6Z" />
          </>
        ) : (
          <>
            <path d="m23 14 2.5 7.5L33 24l-7.5 2.5L23 34l-2.5-7.5L13 24l7.5-2.5ZM98 81l2 6 6 2-6 2-2 6-2-6-6-2 6-2ZM82 6l1.5 4.5L88 12l-4.5 1.5L82 18l-1.5-4.5L76 12l4.5-1.5Z" />
            <circle cx="10" cy="78" r="2" />
            <circle cx="72" cy="113" r="1.5" />
          </>
        )}
      </g>
    </svg>
  );
}
