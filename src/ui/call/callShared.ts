/** Asks the shell to open the community's Invite dialog (Shell listens; calls aren't given the shell's dialogs). */
export const INVITE_EVENT = "meldiq:invite-to-community";

/** Check the API, including on phones: user-agent blocking hides working capture on newer browsers. */
export { screenShareSupport } from "../../call/screenShareSupport";
