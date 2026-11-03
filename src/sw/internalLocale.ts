import errors from "../../locales/en/errors.json";

/**
 * Build-only substitute for page localization in worker-internal failures. The push handler never displays these
 * exceptions: its visible notification copy is mirrored from the selected page locale in WakePrefs. Keeping the page
 * resolver out also prevents a classic worker from trying to import Next.js locale chunks during a failed request.
 */
export function text(_key: string, _variables?: unknown): string {
  return errors.generic;
}
export function apiErrorMessage(_code: string, _status: number, original: string): string {
  return original;
}
