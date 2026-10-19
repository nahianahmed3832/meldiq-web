import { clock, dayLabel } from "../format";

/** "Today 3:15 PM", "Tomorrow 9:00 AM", "Mon 9:00 AM": when something is due. */
export function whenLabel(t: number, now = Date.now()): string {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const d = new Date(t);
  const day = sameDay(d, tomorrow) ? "Tomorrow" : dayLabel(t, now);
  return `${day} ${clock(t)}`;
}

/** A timestamp as the value of an <input type="datetime-local"> in this browser's zone, and back. */
export function toLocalInput(t: number): string {
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(v: string): number | null {
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}
