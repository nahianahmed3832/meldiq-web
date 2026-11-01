/** Session-only reading metadata, scoped by account, conversation and thread. No message content is stored. */
export interface ReadingPosition {
  id: string | null;
  offset: number;
  atBottom: boolean;
  at: number;
}
const KEY = "meldiq.readingPositions";
const MAX = 80;
const MAX_AGE = 7 * 24 * 60 * 60_000;
export const readingScope = (userId: string, conversationId: string, threadRoot?: string) => JSON.stringify([userId, conversationId, threadRoot ?? null]);

function positions(): Record<string, ReadingPosition> {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        ([, p]) =>
          p &&
          (p.id === null || typeof p.id === "string") &&
          Number.isFinite(p.offset) &&
          typeof p.atBottom === "boolean" &&
          Number.isFinite(p.at) &&
          p.at <= Date.now() &&
          Date.now() - p.at < MAX_AGE,
      ),
    );
  } catch {
    return {};
  }
}

export function readingPosition(scope: string): ReadingPosition | null {
  return positions()[scope] ?? null;
}
export function rememberReading(scope: string, position: Omit<ReadingPosition, "at">): void {
  try {
    const entries = Object.entries({ ...positions(), [scope]: { ...position, at: Date.now() } })
      .sort((a, b) => b[1].at - a[1].at)
      .slice(0, MAX);
    sessionStorage.setItem(KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* The current view still anchors when session storage is unavailable. */
  }
}
export function forgetReadingPositions(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* Storage unavailable. */
  }
}
