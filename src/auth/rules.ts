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
  if (!e) return "Enter your email address.";
  if (e.length > EMAIL_MAX_LENGTH || !EMAIL_SHAPE.test(e)) return "Enter an email address like name@example.com.";
  return null;
}

export function passwordProblem(password: string, email: string): string | null {
  const length = [...password].length;
  if (length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (length > PASSWORD_MAX_LENGTH) return `Use at most ${PASSWORD_MAX_LENGTH} characters.`;
  if (password.trim().toLowerCase() === normalizeEmail(email)) return "Your password can't be your email address.";
  return null;
}

export function nameProblem(name: string): string | null {
  const n = name.trim();
  if (!n) return "Enter your name.";
  if ([...n].length > NAME_MAX_LENGTH) return `Use at most ${NAME_MAX_LENGTH} characters.`;
  return null;
}

/** "123 456", "123-456" or "123456" → "123456". */
export function cleanVerifyCode(code: string): string {
  return code.replace(/\D/g, "");
}

/** Seconds to wait from a refusal's Retry-After, rounded up to a whole minute when long. */
export function waitText(retryAfterMs: number | undefined): string {
  if (!retryAfterMs) return "a moment";
  const s = Math.ceil(retryAfterMs / 1000);
  if (s < 60) return `${s} seconds`;
  const m = Math.ceil(s / 60);
  return m === 1 ? "a minute" : `${m} minutes`;
}
