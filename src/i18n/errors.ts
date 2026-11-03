import { ApiError } from "../api/client";
import { text, type Translate } from "./index";

/** Only translate known protocol codes. Never feed arbitrary server/user text to a translation lookup. */
export function localizedError(error: unknown, t: Translate = text): string {
  if (error instanceof ApiError) {
    if (error.isNetwork) return t("errors.network");
    if (error.status === 403 && ["forbidden", "permission_denied", "not_allowed"].includes(error.code)) return t("errors.forbidden");
    return error.message;
  }
  return t("errors.generic");
}
