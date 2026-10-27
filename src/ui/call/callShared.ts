/** Asks the shell to open the community's Invite dialog (Shell listens; calls aren't given the shell's dialogs). */
export const INVITE_EVENT = "meldiq:invite-to-community";

/** Screen sharing needs getDisplayMedia, which phones' browsers don't offer. */
export const canShareScreen = (): boolean => typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function" && !/Android|iPhone|iPad/.test(navigator.userAgent);
