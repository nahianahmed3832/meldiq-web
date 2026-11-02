import { ApiError } from "../../api/client";

/**
 * Tickets (community parity C, feature community-tickets): the rules the screens share. The server checks them all
 * again; these only keep the forms honest and the refusals readable.
 */

export const TICKET_ABOUT_MAX = 300;
export const PANEL_NAME_MAX = 40;
export const MAX_OPEN_CHOICES = [1, 2, 3] as const;
/** Community parity D: a panel's welcome line with Bots+ ({user} mentions the opener, {panel} is its name). */
export const PANEL_WELCOME_MAX = 500;

/** Open tickets per person to choose from: 1–3, or 1–10 with Bots+. */
export function maxOpenChoices(limit: number): number[] {
  return Array.from({ length: Math.max(1, limit) }, (_, i) => i + 1);
}

/** The permissions that make someone ticket staff (besides owners and admins): moderation powers. */
export const STAFF_PERMISSIONS = ["members.timeout", "members.ban", "members.remove", "reports.view"] as const;

/** Whether this person sees every ticket and may close any (owners, admins, moderators). */
export function isTicketStaff(p: { isOwner: boolean; canManageOrg: boolean; effective: readonly string[] }): boolean {
  return p.isOwner || p.canManageOrg || STAFF_PERMISSIONS.some((k) => p.effective.includes(k));
}

/** Ticket channels are named `ticket-<n>-<username>` by the server: only those are looked up in the open tickets. */
export function looksLikeTicket(channelName: string | null | undefined): boolean {
  return !!channelName && /^ticket-\d+-/.test(channelName);
}

/** A refusal from the ticket routes, in words. */
export function ticketError(e: unknown): string {
  if (!(e instanceof ApiError)) return e instanceof Error && e.message ? e.message : "That didn't work. Try again.";
  switch (e.code) {
    case "ticket_limit": {
      const max = (e.details as { max?: unknown } | undefined)?.max;
      return typeof max === "number" ? `You can have ${max} ${max === 1 ? "ticket" : "tickets"} open here at once. Close one first.` : "You have as many tickets open as this community allows.";
    }
    case "tickets_off":
      return "This community has turned tickets off.";
    case "ticket_confirm_required":
      return "Tick the box to say it isn't a bug report, feedback or a suggestion.";
    case "ticket_closed":
      return "This ticket is already closed.";
    case "ticket_channel_invalid":
      return "One of the channels can't be used for tickets. Pick another.";
    case "bots_plus_required":
      return "More than 2 panels, more than 3 open tickets per person, support roles, welcome lines and transcripts need Bots+.";
    default:
      return e.message;
  }
}

export interface PanelDraft {
  /** Kept for an existing panel; absent for a new one. */
  id?: string;
  name: string;
  postChannelId: string;
  categoryId: string | null;
  logChannelId: string | null;
  /** Bots+ (the Tickets bot): sees this panel's tickets and is pinged when one opens. */
  supportRoleId?: string | null;
  /** Bots+: said in each new ticket of this panel. */
  welcomeMessage?: string | null;
  /** The panel's last posted message (views only). */
  postedMessageId?: string | null;
}

/** Why the panels can't be saved, or null. */
export function panelsProblem(panels: readonly PanelDraft[], limit: number): string | null {
  if (panels.length > limit) return `A community has ${limit} panels at most.`;
  for (const [i, p] of panels.entries()) {
    const n = `Panel ${i + 1}`;
    if (!p.name.trim()) return `${n} needs a name.`;
    if ([...p.name.trim()].length > PANEL_NAME_MAX) return `${n}: keep the name to ${PANEL_NAME_MAX} characters.`;
    if (!p.postChannelId) return `${n}: pick the channel its message goes in.`;
    if (p.welcomeMessage && [...p.welcomeMessage.trim()].length > PANEL_WELCOME_MAX) return `${n}: keep the welcome line to ${PANEL_WELCOME_MAX} characters.`;
  }
  return null;
}
