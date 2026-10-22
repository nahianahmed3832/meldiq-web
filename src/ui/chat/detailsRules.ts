/** A conversation's details tabs (batches B14 and B14b, android DetailsRules). */
export type DetailsTab = "members" | "media" | "pins" | "threads" | "links" | "files";

/**
 * A group opens on Members; a DM on Media, since its two people are already in the header. A channel has Threads too,
 * except a forum, whose posts are its threads. A voice channel holds no messages: only its members.
 */
export function detailsTabs(type: "DM" | "GROUP" | "CHANNEL", format: string | null = null, voice = false): DetailsTab[] {
  if (type === "DM") return ["media", "pins", "links", "files"];
  if (voice) return ["members"];
  if (type === "GROUP") return ["members", "media", "pins", "links", "files"];
  return format === "forum" ? ["members", "media", "pins", "links", "files"] : ["members", "media", "pins", "threads", "links", "files"];
}
