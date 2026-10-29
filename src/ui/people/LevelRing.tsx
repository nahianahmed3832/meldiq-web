/**
 * Account levels (API 0.65.0): bought with points, shown as a number in a ring whose colour changes every 10 levels
 * (the server leaves the colours to the apps). Level 101 and up keep the last colour.
 */

/** One colour per 10 levels: 1–10, 11–20 … 91–100. */
export const LEVEL_COLORS = ["#94a3b8", "#22c55e", "#14b8a6", "#0ea5e9", "#6366f1", "#a855f7", "#ec4899", "#ef4444", "#f97316", "#eab308"] as const;
const LEVELS_PER_COLOR = 10;

export function levelColor(level: number): string {
  const step = Math.floor((Math.max(1, level) - 1) / LEVELS_PER_COLOR);
  return LEVEL_COLORS[Math.min(step, LEVEL_COLORS.length - 1)];
}

interface LevelRingProps {
  level: number;
  size: number;
  /** How far towards the next level (0–1); a full ring when left out. */
  progress?: number;
  className?: string;
}

/** The level in its ring; screen readers hear "Level 12". */
export function LevelRing({ level, size, progress, className }: LevelRingProps) {
  const stroke = Math.max(2, Math.round(size / 10));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = progress === undefined ? 1 : Math.min(1, Math.max(0, progress));
  const color = levelColor(level);
  return (
    <span className={`level-ring${className ? ` ${className}` : ""}`} style={{ width: size, height: size }} role="img" aria-label={`Level ${level}`} title={`Level ${level}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference * filled} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="level-ring-number" style={{ fontSize: Math.max(9, Math.round(size * 0.36)), color }} aria-hidden="true">
        {level}
      </span>
    </span>
  );
}
