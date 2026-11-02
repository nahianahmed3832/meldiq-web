import { useId } from "react";

/** Meldiq's Embers emblem: a split flame around a bright, diamond-shaped core. */
export function EmberIcon({ size = 24, className = "" }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 32 36" fill="none" className={`ember-icon ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="8" y1="32" x2="24" y2="2" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff703b" />
          <stop offset="1" stopColor="#ffd178" />
        </linearGradient>
      </defs>
      <path d="M17 1C18 9 28 12 28 22c0 7-5 12-12 12S4 29 4 22c0-5 3-9 6-12-1 6 1 8 3 9C10 11 14 7 17 1Z" fill={`url(#${id})`} />
      <path d="m16 18 5 7-5 6-5-6 5-7Z" fill="#fff0b8" />
      <path d="M22 4 24 8M4 13l-2 3" stroke="#ffbb64" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
