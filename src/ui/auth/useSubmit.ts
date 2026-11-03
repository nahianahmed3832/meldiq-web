import { text as uiText } from "../../i18n";
import { useCallback, useState } from "react";
import { ApiError } from "../../api/client";
import { SetupError } from "../../auth/deviceSetup";
import { PasskeyError } from "../../auth/passkeys";
import { waitText } from "../../auth/rules";
import { LinkError } from "../../sync/session";
/** What to tell the person about a failed account request. Server messages are written for people; others aren't shown. */
export function authErrorText(e: unknown): string {
  if (e instanceof SetupError || e instanceof LinkError || e instanceof PasskeyError) return e.message;
  if (e instanceof ApiError) {
    if (e.isNetwork) return uiText("auth.interface.can_t_reach_the_meldiq_server_check_your_connection_and_try_again_dc10a2f");
    if (e.status === 429) return uiText("auth.interface.too_many_attempts_try_again_in_value0_71a57b4", { value0: waitText(e.retryAfterMs) });
    if (e.status === 404 && e.code === "http") return uiText("auth.interface.this_meldiq_server_doesn_t_have_email_accounts_yet_it_needs_an_up_c7371a5");
    return e.message;
  }
  return uiText("errors.generic");
}
/** Runs one request at a time for a form: busy while it runs, its error as text. */
export function useSubmit(): {
  busy: boolean;
  error: string | null;
  setError: (e: string | null) => void;
  run: (fn: () => Promise<void>) => Promise<void>;
} {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(authErrorText(e));
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, setError, run };
}
