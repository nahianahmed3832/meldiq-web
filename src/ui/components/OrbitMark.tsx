import { useId } from "react";

/**
 * The Orbit mark: a glossy planet with a tilted ring and a satellite on a deep-green tile, drawn from the Android launcher
 * icon's own vector layers (android res/drawable/ic_launcher_foreground.xml and ic_launcher_background.xml).
 */
export function OrbitMark({ size = 40, tile = true, title = "Orbit" }: { size?: number; tile?: boolean; title?: string }) {
  const id = useId().replace(/:/g, "");
  const g = (n: string) => `${id}-${n}`;
  return (
    <svg width={size} height={size} viewBox="14 14 80 80" role="img" aria-label={title} style={{ borderRadius: size * 0.26, flexShrink: 0, display: "block" }}>
      <defs>
        <radialGradient id={g("tile")} cx="54" cy="46" r="78" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0F3A2E" />
          <stop offset="0.5" stopColor="#0A231C" />
          <stop offset="1" stopColor="#040A08" />
        </radialGradient>
        <radialGradient id={g("glow")} cx="54" cy="54" r="36" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3EE0A0" stopOpacity="0.3" />
          <stop offset="0.6" stopColor="#3EE0A0" stopOpacity="0.1" />
          <stop offset="1" stopColor="#3EE0A0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={g("planet")} cx="45" cy="41" r="34" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#D2FCE6" />
          <stop offset="0.45" stopColor="#63E3AE" />
          <stop offset="1" stopColor="#138F66" />
        </radialGradient>
        <linearGradient id={g("ring")} x1="24.08" y1="66.51" x2="78.36" y2="32.59" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#22B47C" />
          <stop offset="0.55" stopColor="#7FF0BF" />
          <stop offset="1" stopColor="#D8FFEC" />
        </linearGradient>
        <radialGradient id={g("moon")} cx="69.6" cy="39.54" r="6.5" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F4FFF9" />
          <stop offset="0.5" stopColor="#9DF5CD" />
          <stop offset="1" stopColor="#35C487" />
        </radialGradient>
        <clipPath id={g("clip")}>
          <path d="M54,32.5 A21.5,21.5 0 1,1 54,75.5 A21.5,21.5 0 1,1 54,32.5 Z" />
        </clipPath>
      </defs>
      {tile && <rect x="0" y="0" width="108" height="108" fill={`url(#${g("tile")})`} />}
      <path d="M18,54 A36,36 0 1,1 90,54 A36,36 0 1,1 18,54 Z" fill={`url(#${g("glow")})`} />
      <path d="M78.355,32.59 A32,9 -32 0,0 60.584,34.49" stroke="#3FD69A" strokeWidth="2.3" strokeLinecap="round" fill="none" />
      <path d="M24.08,66.505 A32,9 -32 0,1 33.578,51.365" stroke="#3FD69A" strokeWidth="2.3" strokeLinecap="round" fill="none" />
      <path
        d="M54,32.5 A21.5,21.5 0 1,1 54,75.5 A21.5,21.5 0 1,1 54,32.5 Z M54.882,38.011 A10,15 15 1,0 47.118,66.989 A10,15 15 1,0 54.882,38.011 Z"
        fillRule="evenodd"
        fill={`url(#${g("planet")})`}
      />
      <path d="M54.882,38.011 A10,15 15 1,0 47.118,66.989 A10,15 15 1,0 54.882,38.011 Z" stroke="#0B5E43" strokeOpacity="0.6" strokeWidth="1.2" fill="none" />
      <g clipPath={`url(#${g("clip")})`}>
        <path d="M24.08,66.505 A32,7.5 -32 0,0 78.355,32.59 A32,3 -32 0,1 24.08,66.505 Z" stroke="#081A15" strokeOpacity="0.9" strokeWidth="1.9" strokeLinejoin="round" fill="none" />
        <circle cx="71.403" cy="41.545" r="6.1" fill="#081A15" fillOpacity="0.9" />
      </g>
      <path d="M24.08,66.505 A32,7.5 -32 0,0 78.355,32.59 A32,3 -32 0,1 24.08,66.505 Z" fill={`url(#${g("ring")})`} />
      <circle cx="71.403" cy="41.545" r="5.2" fill={`url(#${g("moon")})`} />
      <circle cx="69.703" cy="39.645" r="1.5" fill="#FFFFFF" fillOpacity="0.5" />
    </svg>
  );
}
