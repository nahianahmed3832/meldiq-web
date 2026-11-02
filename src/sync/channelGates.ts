import { ApiError } from "../api/client";
import type { ChannelOptions, Conversation, Org } from "../api/schemas";

/**
 * What the composer and message menus offer in a community channel (community parity A1–A3): the person's effective
 * permissions in the community, the channel's options (text only, no GIFs, read-only) and the community's lock and
 * onboarding gate. Only decides what to show; the server checks every message again and its refusals become notes.
 */

/** This person's standing in a community, from its detail (GET /v1/orgs/:id). Null while loading or outside one. */
export interface CommunityAccess {
  isOwner: boolean;
  effective: readonly string[];
  myRoleIds: readonly string[];
}

export interface ChannelAbilities {
  /** Files and pictures. */
  attach: boolean;
  voice: boolean;
  gifs: boolean;
  stickers: boolean;
  polls: boolean;
  /** Reacting with an emoji that isn't on the message yet (joining an existing reaction stays open). */
  newReactions: boolean;
  headings: boolean;
  threads: boolean;
  /** Pinning, and deleting other people's messages (messages.manage or managing the channel). */
  moderate: boolean;
  /** Mentioning any role, mentionable or not. */
  mentionAnyRole: boolean;
  /** Source communities remain membership-checked by the server. */
  externalEmoji: boolean;
  /** A read-only channel this person may not post in. */
  readOnlyHere: boolean;
}

type ChannelLike = Pick<Conversation, "type" | "orgId" | "canPost" | "canManage"> & { canAttach?: boolean; options?: ChannelOptions | null };

const OPEN: ChannelAbilities = {
  attach: true,
  voice: true,
  gifs: true,
  stickers: true,
  polls: true,
  newReactions: true,
  headings: true,
  threads: true,
  moderate: false,
  mentionAnyRole: false,
  externalEmoji: true,
  readOnlyHere: false,
};

/**
 * [access] null (not loaded yet, or a server without community-permissions): everyday keys count as held, so nothing
 * hides by mistake; moderation shows only when known. [permissionsOn]: the server has community-permissions, so pinning
 * needs messages.manage there, as in the reference.
 */
export function channelAbilities(c: ChannelLike, access: CommunityAccess | null, permissionsOn: boolean): ChannelAbilities {
  const attach = c.canAttach ?? c.canPost;
  if (c.type !== "CHANNEL" || !c.orgId) return { ...OPEN, attach, voice: attach, moderate: c.canPost };
  const holds = (key: string) => access === null || access.isOwner || access.effective.includes(key);
  const known = (key: string) => access !== null && (access.isOwner || access.effective.includes(key));
  const moderator = c.canManage || known("messages.manage");
  const o = c.options;
  const textOnly = !!o?.textOnly && !moderator;
  const noGifs = (!!o?.noGifs || !!o?.textOnly) && !moderator;
  const poster = !o?.readOnly || moderator || (access?.myRoleIds ?? []).some((r) => o.posterRoleIds.includes(r));
  return {
    attach: attach && !textOnly,
    voice: attach && !textOnly && holds("messages.voice"),
    gifs: !noGifs,
    stickers: !textOnly,
    polls: holds("messages.polls"),
    newReactions: holds("messages.react"),
    headings: holds("messages.big_text"),
    threads: holds("threads.create"),
    moderate: permissionsOn ? moderator : c.canPost,
    mentionAnyRole: known("messages.mention_all"),
    externalEmoji: !permissionsOn || known("messages.external_emoji"),
    readOnlyHere: !poster,
  };
}

/** Lines starting with #, ## or ### and a space (Use Big Text). */
export const hasHeading = (text: string): boolean => /^#{1,3} /m.test(text);

/** Why this person can't post in [c] now, from the community's own state; null when nothing stops them. */
export function communityHold(org: Pick<Org, "lockedUntil" | "mustFinishOnboarding"> | null | undefined, abilities: ChannelAbilities, now = Date.now()): ComposerHold | null {
  if (!org) return null;
  if (org.mustFinishOnboarding) return { kind: "onboarding" };
  if (org.lockedUntil && org.lockedUntil > now && !abilities.moderate) return { kind: "locked", until: org.lockedUntil };
  if (abilities.readOnlyHere) return { kind: "readOnly" };
  return null;
}

export type ComposerHold = { kind: "onboarding" } | { kind: "locked"; until: number } | { kind: "readOnly" };

/** The server's refusal codes for content rules (docs/COMMUNITY_PERMISSIONS.md, COMMUNITY_SAFETY_API.md, …). */
const REFUSALS: Record<string, string> = {
  reactions_not_allowed: "You can't add new reactions here. You can still join the ones already on a message.",
  links_not_allowed: "Links aren't allowed for you in this channel.",
  text_only_channel: "This channel is text only: no files, GIFs or stickers.",
  gifs_not_allowed: "GIFs aren't allowed in this channel. Pictures are fine.",
  read_only_channel: "This channel is read-only. Only some roles can post here.",
  voice_messages_not_allowed: "You can't send voice messages here.",
  external_emoji_not_allowed: "Emoji from other communities aren't allowed for you here.",
  polls_not_allowed: "You can't make polls here.",
  headings_not_allowed: "Headings (#) aren't allowed for you here. Remove the # at the start of the line.",
  threads_not_allowed: "You can't start threads here.",
  thread_replies_not_allowed: "You can't reply in threads here.",
  role_mention_not_allowed: "You can't mention that role.",
  manage_messages_required: "Only moderators can do that here.",
  community_locked_posting: "This community is locked. Only moderators can post right now.",
  onboarding_not_finished: "Finish this community's onboarding before you post or react.",
  nickname_not_allowed: "You can't change your nickname in this community.",
  voice_banned: "You've been banned from this community's voice channels.",
};

/** The friendly line for a refusal [code], for checks the composer makes itself before sending. */
export function refusalText(code: string): string | null {
  return REFUSALS[code] ?? null;
}

/** A friendly line for a refusal the composer should explain, or null for any other error. */
export function refusalNote(e: unknown, now = Date.now()): string | null {
  if (!(e instanceof ApiError)) return null;
  if (e.code === "verification_required") return verificationNote(e.details, now);
  const base = REFUSALS[e.code];
  if (!base) return null;
  const until = untilOf(e.details);
  if (e.code === "community_locked_posting" && until) return `This community is locked for ${waitWords(until - now)}. Only moderators can post right now.`;
  return base;
}

function untilOf(details: unknown): number | null {
  const u = (details as { until?: unknown } | undefined)?.until;
  return typeof u === "number" ? u : null;
}

/** verification_required: a missing email, or how long until the person may post. */
export function verificationNote(details: unknown, now = Date.now()): string {
  const d = (details ?? {}) as { reason?: unknown; allowedAt?: unknown };
  if (d.reason === "email" || typeof d.allowedAt !== "number") return "This community asks for a verified email before you post. Verify yours in Settings › Account.";
  return d.allowedAt <= now ? "You can post now. Try again." : `This community asks newcomers to wait a little. You can post in ${waitWords(d.allowedAt - now)}.`;
}

/** "45 seconds", "3 minutes", "2 hours", "1 day". */
export function waitWords(ms: number): string {
  const s = Math.max(1, Math.ceil(ms / 1000));
  const unit = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  if (s < 60) return unit(s, "second");
  const m = Math.ceil(s / 60);
  if (m < 60) return unit(m, "minute");
  const h = Math.ceil(m / 60);
  if (h < 48) return unit(h, "hour");
  return unit(Math.ceil(h / 24), "day");
}

/** The org changes a refusal implies, so the composer shows the right bar at once (like rules_not_agreed). */
export function orgAfterRefusal(org: Org, e: unknown): Org {
  if (!(e instanceof ApiError)) return org;
  if (e.code === "onboarding_not_finished") return { ...org, mustFinishOnboarding: true };
  if (e.code === "community_locked_posting") return { ...org, lockedUntil: untilOf(e.details) ?? org.lockedUntil };
  return org;
}

/** Whether [senderUserId] may delete [authorId]'s message for everyone: the author, or a moderator in a community channel (the server checked). */
export function deleteAllowed(authorId: string, senderUserId: string, communityChannel: boolean): boolean {
  return authorId === senderUserId || communityChannel;
}
