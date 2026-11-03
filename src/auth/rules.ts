import { formatUnit } from "../i18n/format";
import { text as uiText } from "../i18n";
/**
 * The account form rules the server applies (server/src/accounts/passwords.ts, schemas.ts), shown before sending so
 * people get the message at once. The server's check is the one that counts.
 */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;
export const NAME_MAX_LENGTH = 80;
const EMAIL_MAX_LENGTH = 254;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
export function emailProblem(email: string): string | null {
  const e = normalizeEmail(email);
  if (!e) return uiText("auth.interface.enter_your_email_address_280f46b");
  if (e.length > EMAIL_MAX_LENGTH || !EMAIL_SHAPE.test(e)) return uiText("auth.interface.enter_an_email_address_like_name_example_com_ad660a6");
  return null;
}
export function passwordProblem(password: string, email: string): string | null {
  const length = [...password].length;
  if (length < PASSWORD_MIN_LENGTH) return uiText("auth.interface.use_at_least_value0_characters_ff13327", { value0: PASSWORD_MIN_LENGTH });
  if (length > PASSWORD_MAX_LENGTH) return uiText("auth.interface.use_at_most_value0_characters_ae37340", { value0: PASSWORD_MAX_LENGTH });
  if (password.trim().toLowerCase() === normalizeEmail(email)) return uiText("auth.interface.your_password_can_t_be_your_email_address_9d9f9e9");
  return null;
}
export function nameProblem(name: string): string | null {
  const n = name.trim();
  if (!n) return uiText("auth.interface.enter_your_name_a480220");
  if ([...n].length > NAME_MAX_LENGTH) return uiText("auth.interface.use_at_most_value0_characters_ae37340", { value0: NAME_MAX_LENGTH });
  return null;
}
/** "123 456", "123-456" or "123456" → "123456". */
export function cleanVerifyCode(code: string): string {
  return code.replace(/\D/g, "");
}
/** Seconds to wait from a refusal's Retry-After, rounded up to a whole minute when long. */
export function waitText(retryAfterMs: number | undefined): string {
  if (!retryAfterMs) return uiText("auth.interface.a_moment_810d9b6");
  const s = Math.ceil(retryAfterMs / 1000);
  if (s < 60) return uiText("auth.interface.value0_seconds_ee5e46c", { value0: s });
  const m = Math.ceil(s / 60);
  return formatUnit(m, "minute");
}
