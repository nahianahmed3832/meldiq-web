import fs from "node:fs";
import path from "node:path";
import { validateCatalogs } from "./check.mjs";

// Exact keys introduced by the 15-file Messages/Later refresh, plus the separately integrated multi-tab warning.
export const refreshKeys = [
  "messagesIntro",
  "laterIntro",
  "savedTab",
  "remindersTab",
  "savedSearchHint",
  "clearFilters",
  "savedResults",
  "noSavedMatchesHelp",
  "unavailableCollection",
  "unavailableCollectionHelp",
  "viewScope",
  "rememberingView",
  "viewNotRemembered",
  "viewLoadError",
  "viewSaveError",
  "savingCollection",
  "clearQuery",
  "noPeopleMatches",
].map((key) => `workspace.experience.${key}`);
const tabKeys = ["workspace.experience.draftNotSavedInTab"];
const scope = new Set([...refreshKeys, ...tabKeys]);
const report = validateCatalogs();
const locales = Object.fromEntries(
  Object.entries(report.coverage).map(([locale, coverage]) => [
    locale,
    {
      missingRefresh: coverage.missing.filter((key) => refreshKeys.includes(key)),
      missingMultiTab: coverage.missing.filter((key) => tabKeys.includes(key)),
      untranslatedScope: coverage.untranslated.filter((key) => scope.has(key)),
      olderMissing: coverage.missing.filter((key) => !scope.has(key)).length,
      nativeReview: coverage.nativeReview,
    },
  ]),
);
const errors = report.errors.filter((error) => scope.has(error.key));
const passed = errors.length === 0 && Object.values(locales).every((locale) => !locale.missingRefresh.length && !locale.missingMultiTab.length && !locale.untranslatedScope.length);
const result = {
  passed,
  refreshKeys,
  multiTabKeys: tabKeys,
  englishKeys: report.englishKeys,
  locales,
  errors,
  policy: "This scoped check supplements i18n:check; it does not waive the full release gate or native-language review.",
};
const output = process.argv[2];
if (output) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
}
console.log(`Refresh: ${refreshKeys.length} keys; multi-tab: ${tabKeys.length} key; ${Object.keys(locales).length} locales; ${passed ? "PASS" : "FAIL"}. Full catalog complete: ${report.complete}.`);
if (!passed) console.error(JSON.stringify(result, null, 2));
process.exitCode = passed ? 0 : 1;
