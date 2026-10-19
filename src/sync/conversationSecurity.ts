/**
 * What a conversation's security panel says (android ConversationSecurity, docs/SECURITY_AND_PRIVACY.md): the header
 * shows a small padlock, and the panel lists only the facts that apply to this conversation, each true of how the app
 * works today. The browser always encrypts call media end to end (it has no unencrypted fallback).
 */
export type SecurityPoint = "messages" | "files" | "calls_e2ee" | "verified" | "not_verified" | "verify_members" | "keys_changed" | "other_servers" | "app_updates" | "metadata";

export interface SecurityFacts {
  type: "DM" | "GROUP" | "CHANNEL";
  /** A DM: whether the other person is verified; null for groups and channels. */
  peerVerified: boolean | null;
  /** Members whose security key changed and isn't reviewed yet. */
  changedMembers: number;
  /** Members on another server (federated usernames, `name:server`). */
  otherServers: number;
}

export function securityPoints(f: SecurityFacts): SecurityPoint[] {
  const points: SecurityPoint[] = [];
  if (f.changedMembers > 0) points.push("keys_changed");
  points.push("messages", "files", "calls_e2ee");
  if (f.type !== "DM") points.push("verify_members");
  else points.push(f.peerVerified ? "verified" : "not_verified");
  if (f.otherServers > 0) points.push("other_servers");
  if (f.type === "CHANNEL") points.push("app_updates");
  points.push("metadata");
  return points;
}

/** The padlock is drawn in the warning colour when something needs the person's attention. */
export const needsAttention = (f: SecurityFacts): boolean => f.changedMembers > 0;

/** A username of someone on another server (`name:server`, docs/FEDERATION_PROTOCOL.md). */
export const isRemoteUsername = (username: string): boolean => username.includes(":");
