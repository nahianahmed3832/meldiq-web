import { useCallback, useState } from "react";
import { ApiError } from "../../api/client";
import { SetupError } from "../../auth/deviceSetup";
import { waitText } from "../../auth/rules";
import { LinkError } from "../../sync/session";

/** What to tell the person about a failed account request. Server messages are written for people; others aren't shown. */
export function authErrorText(e: unknown): string {
  if (e instanceof SetupError || e instanceof LinkError) return e.message;
  if (e instanceof ApiError) {
    if (e.isNetwork) return "Can't reach the Meldiq server. Check your connection and try again.";
    if (e.status === 429) return `Too many attempts. Try again in ${waitText(e.retryAfterMs)}.`;
    if (e.status === 404 && e.code === "http") return "This Meldiq server doesn't have email accounts yet. It needs an update.";
    return e.message;
  }
  return "Something went wrong. Try again.";
}

/** Runs one request at a time for a form: busy while it runs, its error as text. */
export function useSubmit(): { busy: boolean; error: string | null; setError: (e: string | null) => void; run: (fn: () => Promise<void>) => Promise<void> } {
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
