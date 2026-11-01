import { EmberIcon } from "./EmberIcon";

/** Meldiq's rounded, two-tone settings symbols. Each mark shares a 24px drawing grid. */
const paths = {
  account: "M8 20v-2a4 4 0 0 1 8 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 20h16",
  profile: "M3 20v-2a6 6 0 0 1 9-5M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7m6 4 3-3 3 3-6 6-4 1 1-4 3-3Z",
  security: "M12 2 4 5v6c0 5 8 11 8 11s8-6 8-11V5l-8-3Zm-4 9 3 3 5-6",
  devices: "M8 3h9a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm3 15h3M10 6h5",
  mojo: "m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Zm6 0v4m-2-2h4M3 18v4m-2-2h4",
  spark: "m5 4-3 6 10 12 10-12-3-6H5Zm-3 6h20M8 4l-2 6 6 12 6-12-2-6M8 4h8",
  appearance: "M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 2-2c0-1-1-2-1-3a2 2 0 0 1 2-2h2c2 0 3-1 3-3 0-4-4-8-9-8ZM7 9h.01M11 6h.01M16 7h.01M6 14h.01",
  voice: "M4 15v-4a8 8 0 0 1 16 0v4M4 12H3v7h4v-7H4Zm16 0h1v7h-4v-7h3Zm-3 7v1c0 1-2 2-4 2h-1",
  notifications: "M5 16h14l-2-3V9a5 5 0 0 0-10 0v4l-2 3Zm5 4h4M12 2v2m7 0 2 3M5 4 3 7",
  shortcuts: "M3 5h18v14H3V5Zm3 4h1m3 0h1m3 0h1m3 0h.01M6 12h1m3 0h1m3 0h1m3 0h.01M7 16h10",
  advanced: "M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6M10 15v6",
  developer: "m8 5-6 7 6 7m8-14 6 7-6 7m-3-16-2 18",
  creators: "M4 8h16v12H4V8Zm0 0L3 4l16-2 1 4L4 8Zm3-5 3 4m4-5 3 4m-7 6 5 3-5 3v-6Z",
  leaderboards: "M7 3h10v5a5 5 0 0 1-10 0V3Zm0 2H3v3a4 4 0 0 0 5 4m9-7h4v3a4 4 0 0 1-5 4m-4 1v5m-5 3h10m-8-3h6l1 3H8l1-3Z",
  level: "m3 6 5 4 4-7 4 7 5-4-2 13H5L3 6Zm3 9h12",
  messages: "M12 3c-6 0-10 3-10 8 0 3 2 5 4 7l-1 4 5-3h2c6 0 10-3 10-8S18 3 12 3ZM7 11h.01M12 11h.01M17 11h.01",
  gifts: "M3 9h18v4H3V9Zm2 4v8h14v-8m-7-4v12M12 9C5 9 5 3 8 3c3 0 4 6 4 6Zm0 0s1-6 4-6c3 0 3 6-4 6Z",
  invites: "M3 21v-2a6 6 0 0 1 10-4M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m9 3v8m-4-4h8",
} as const;
export type SettingsSymbol = keyof typeof paths | "embers";
export function SettingsIcon({ name, size = 22 }: { name: SettingsSymbol; size?: number }) {
  if (name === "embers") return <EmberIcon size={size} />;
  return (
    <svg
      className={`meldiq-symbol symbol-${name}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path className="symbol-glow" d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z" fill="currentColor" stroke="none" opacity=".08" />
      <path d={paths[name]} />
    </svg>
  );
}

/** A faceted Meldiq medal, with a rank that also makes tied podium places explicit. */
export function RankMedal({ rank }: { rank: number }) {
  return (
    <span className={`rank-medal medal-${Math.min(rank, 3)}`} aria-label={`Rank ${rank}`}>
      <svg width="36" height="42" viewBox="0 0 36 42" aria-hidden="true">
        <path d="m8 1 6 1 4 13-7 3L8 1Zm20 0-6 1-4 13 7 3 3-17Z" fill="currentColor" opacity=".55" />
        <path d="m18 10 13 7v15l-13 8-13-8V17l13-7Z" fill="currentColor" />
        <path d="m18 14 9 5v11l-9 6-9-6V19l9-5Z" fill="none" stroke="currentColor" className="medal-inset" />
      </svg>
      <b aria-hidden="true">{rank}</b>
    </span>
  );
}
