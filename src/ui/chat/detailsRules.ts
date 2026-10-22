/** A direct message's or group's details tabs (batch B14, android DetailsRules). */
export type DetailsTab = "members" | "media" | "pins" | "links" | "files";

/** A group opens on Members; a DM on Media, since its two people are already in the header. */
export function detailsTabs(type: "DM" | "GROUP" | "CHANNEL"): DetailsTab[] {
  const shared: DetailsTab[] = ["media", "pins", "links", "files"];
  return type === "GROUP" ? ["members", ...shared] : shared;
}
