import type { UnreadMarker } from "../unread";

/**
 * The count beside a row or on a community icon (ui/unread.ts decides which). A single unread event shows no badge: its
 * row's highlight says it. Decorative: the row's own label carries the numbers for screen readers.
 */
export function UnreadBadge({ marker }: { marker: UnreadMarker }) {
  if (marker.kind === "count")
    return (
      <span className={`count ${marker.direct ? "accent" : "unread-count"}`} aria-hidden="true">
        {marker.text}
      </span>
    );
  if (marker.kind === "mention")
    return (
      <span className="count mention-count" aria-hidden="true">
        {marker.text}
      </span>
    );
  return null;
}
