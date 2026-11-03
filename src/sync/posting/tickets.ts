import { countLabel } from "../../i18n/counts";
import { text as uiText } from "../../i18n";
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
  if (!(e instanceof ApiError)) return e instanceof Error && e.message ? e.message : uiText("workspace.interface.that_didn_t_work_try_again_5da2573");
  switch (e.code) {
    case "ticket_limit": {
      const max = (
        e.details as
          | {
              max?: unknown;
            }
          | undefined
      )?.max;
      return typeof max === "number"
        ? uiText("workspace.interface.native_count_d5fc54efe", { value0: countLabel(max, "tickets"), value1: "" })
        : uiText("workspace.interface.you_have_as_many_tickets_open_as_this_community_allows_0c1f3db");
    }
    case "tickets_off":
      return uiText("workspace.interface.this_community_has_turned_tickets_off_fbc6ce2");
    case "ticket_confirm_required":
      return uiText("workspace.interface.tick_the_box_to_say_it_isn_t_a_bug_report_feedback_or_a_suggestio_50613b8");
    case "ticket_closed":
      return uiText("workspace.interface.this_ticket_is_already_closed_f3d5951");
    case "ticket_channel_invalid":
      return uiText("workspace.interface.one_of_the_channels_can_t_be_used_for_tickets_pick_another_8068cd1");
    case "bots_plus_required":
      return uiText("workspace.interface.more_than_2_panels_more_than_3_open_tickets_per_person_support_ro_5e40019");
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
  if (panels.length > limit) return uiText("workspace.interface.a_community_has_value0_panels_at_most_8cf0815", { value0: limit });
  for (const [i, p] of panels.entries()) {
    const n = uiText("workspace.interface.panel_value0_38c86da", { value0: i + 1 });
    if (!p.name.trim()) return uiText("workspace.interface.value0_needs_a_name_00acf37", { value0: n });
    if ([...p.name.trim()].length > PANEL_NAME_MAX) return uiText("workspace.interface.value0_keep_the_name_to_value1_characters_ed9c508", { value0: n, value1: PANEL_NAME_MAX });
    if (!p.postChannelId) return uiText("workspace.interface.value0_pick_the_channel_its_message_goes_in_fc3a585", { value0: n });
    if (p.welcomeMessage && [...p.welcomeMessage.trim()].length > PANEL_WELCOME_MAX)
      return uiText("workspace.interface.value0_keep_the_welcome_line_to_value1_characters_15effe1", { value0: n, value1: PANEL_WELCOME_MAX });
  }
  return null;
}
