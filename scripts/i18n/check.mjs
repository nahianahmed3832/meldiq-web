import fs from "node:fs";
import path from "node:path";
import { parse, TYPE } from "@formatjs/icu-messageformat-parser";
import { LANGUAGES } from "../../src/i18n/languages.ts";
import { NAMESPACES } from "../../src/i18n/namespaces.ts";
import { inventory, root } from "./audit.mjs";
import { publicInventory } from "./public-audit.mjs";
import { fiveWordPhrases, proseWords } from "./phrases.mjs";
import { unexpectedWritingSystem, textEntryInstruction, hasNativeWritingSystem } from "./scripts.mjs";

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const protectedPattern = (name) => new RegExp(`(?<![A-Za-z0-9_])${escapeRegExp(name)}(?![A-Za-z0-9_])`, "i");

export function flatten(object, prefix = "") {
  if (!object || typeof object !== "object" || Array.isArray(object)) throw new Error("Dictionary must be a JSON object");
  return Object.fromEntries(
    Object.entries(object).flatMap(([key, value]) => {
      if (!key || key.includes(".")) throw new Error(`Invalid key: ${prefix}${key}`);
      if (typeof value === "string") return [[prefix + key, value]];
      return Object.entries(flatten(value, prefix + key + "."));
    }),
  );
}

export function messageSignature(message, locale) {
  const ast = parse(message, { requiresOtherClause: true });
  const argumentsByName = new Map();
  function walk(elements) {
    for (const element of elements) {
      if ([TYPE.argument, TYPE.number, TYPE.date, TYPE.time, TYPE.select, TYPE.plural, TYPE.tag].includes(element.type)) {
        const kind = element.type === TYPE.plural ? `plural:${element.pluralType}` : element.type;
        if (argumentsByName.has(element.value) && argumentsByName.get(element.value) !== kind) throw new Error(`Inconsistent argument ${element.value}`);
        argumentsByName.set(element.value, kind);
      }
      if (element.type === TYPE.plural) {
        const valid = new Set(new Intl.PluralRules(locale, { type: element.pluralType }).resolvedOptions().pluralCategories);
        for (const category of Object.keys(element.options)) if (!category.startsWith("=") && !valid.has(category)) throw new Error(`Invalid plural category ${category} for ${locale}`);
      }
      if (element.options) for (const option of Object.values(element.options)) walk(option.value);
      if (element.children) walk(element.children);
    }
  }
  walk(ast);
  return JSON.stringify([...argumentsByName].sort(([a], [b]) => a.localeCompare(b)));
}

export function validateCatalogs(base = root) {
  const errors = [];
  const catalogs = {};
  for (const locale of LANGUAGES) {
    catalogs[locale] = {};
    for (const namespace of NAMESPACES) {
      const file = `locales/${locale}/${namespace}.json`;
      try {
        catalogs[locale][namespace] = flatten(JSON.parse(fs.readFileSync(path.join(base, file), "utf8")));
      } catch (error) {
        errors.push({ file, issue: String(error.message) });
        catalogs[locale][namespace] = {};
      }
    }
  }
  const invariants = JSON.parse(fs.readFileSync(path.join(base, "locales/invariants.json"), "utf8"));
  const english = Object.fromEntries(NAMESPACES.flatMap((namespace) => Object.entries(catalogs.en[namespace]).map(([key, value]) => [namespace + "." + key, value])));
  const sourcePhrases = Object.fromEntries(Object.entries(english).map(([key, value]) => [key, fiveWordPhrases(value, invariants.brands)]));
  const coverage = {};
  for (const locale of LANGUAGES) {
    const translations = Object.fromEntries(NAMESPACES.flatMap((namespace) => Object.entries(catalogs[locale][namespace]).map(([key, value]) => [namespace + "." + key, value])));
    const missing = Object.keys(english).filter((key) => !(key in translations));
    const untranslated = [];
    for (const [key, value] of Object.entries(translations)) {
      if (!(key in english)) {
        errors.push({ locale, key, issue: "Unexpected key" });
        continue;
      }
      if (!value.trim()) errors.push({ locale, key, issue: "Empty translation" });
      try {
        if (messageSignature(value, locale) !== messageSignature(english[key], "en")) errors.push({ locale, key, issue: "Mismatched interpolation variables or argument types" });
      } catch (error) {
        errors.push({ locale, key, issue: `Invalid ICU: ${error.message}` });
      }
      if (!english[key].includes(", plural,")) {
        const slots = (message) => JSON.stringify([...message.matchAll(/<slot\d+>/g)].map((match) => match[0]).sort());
        if (slots(value) !== slots(english[key])) errors.push({ locale, key, issue: "Changed inline placeholder multiplicity" });
      }
      if (english[key].includes("\n") && value.split("\n").length !== english[key].split("\n").length) errors.push({ locale, key, issue: "Changed recovery/export/example line structure" });
      let notationText = value;
      let translatedLiterals = [];
      try {
        const literalParts = [];
        const collectLiterals = (nodes) => {
          for (const node of nodes) {
            if (node.type === TYPE.literal) literalParts.push(node.value);
            if (node.children) collectLiterals(node.children);
            if (node.options) for (const option of Object.values(node.options)) collectLiterals(option.value);
          }
        };
        collectLiterals(parse(value));
        translatedLiterals = literalParts;
        notationText = literalParts.join(" ");
      } catch {
        /* Invalid ICU is already reported above. */
      }
      for (const brand of [...invariants.brands].sort((a, b) => b.length - a.length)) notationText = notationText.replaceAll(brand, "");
      notationText = notationText.replace(
        /\b(?:B|KB|MB|GB|TB|px|fps|ms|Hz|kHz|kbps|Mbps|TCP|UDP|TLS|HTTPS?|API|JSON|URL|URI|URIs|ID|IDs|PIN|QR|UTF-8|Ctrl|Shift|Alt|Enter|Esc|Tab|Space|F\d+|[A-Z])\b/g,
        "",
      );
      const notation = !/[\p{L}]/u.test(notationText);
      if (locale !== "en")
        for (const brand of invariants.protectedNames) {
          if (protectedPattern(brand).test(english[key]) && !value.toLowerCase().includes(brand.toLowerCase())) errors.push({ locale, key, issue: `Changed protected product name: ${brand}` });
        }
      if (locale !== "en" && !invariants.identicalTranslations[key]?.includes(locale)) {
        const prose = " " + proseWords(value, invariants.brands).join(" ") + " ";
        const copiedPhrase = sourcePhrases[key].find((phrase) => prose.includes(" " + phrase + " "));
        if (copiedPhrase) errors.push({ locale, key, issue: "Untranslated English phrase: " + copiedPhrase });
      }
      if (locale !== "en" && /\b(?:ON|OFF)\b/.test(value) && /\b(?:on|off)\b/i.test(english[key])) errors.push({ locale, key, issue: "Untranslated on/off state label" });
      if (locale !== "en" && unexpectedWritingSystem(value, english[key], locale)) errors.push({ locale, key, issue: "Unexpected writing system in translation" });
      if (locale !== "en" && textEntryInstruction(english[key]) && /\b(?:Enter|Type)\b/.test(value)) errors.push({ locale, key, issue: "Untranslated text-entry instruction" });
      if (locale !== "en" && hasNativeWritingSystem(value, locale)) {
        if (value.endsWith("Name") && !english[key].includes("Name")) errors.push({ locale, key, issue: "Stray translation suffix" });
        const prose = translatedLiterals.join(" ").replace(/https?:\/\/\S+/g, "");
        if (/\b(?:and|or|the|your|with)\b/.test(prose)) errors.push({ locale, key, issue: "Untranslated English connective in native prose" });
      }
      const comparable = (message) =>
        message
          .replaceAll("''", "'")
          .replace(/[’‘]/g, "'")
          .replace(/[\p{P}\p{Z}\s]/gu, "")
          .toLowerCase();
      const englishLiterals = [];
      try {
        const collect = (nodes) => {
          for (const node of nodes) {
            if (node.type === TYPE.literal) englishLiterals.push(comparable(node.value));
            if (node.children) collect(node.children);
            if (node.options) for (const option of Object.values(node.options)) collect(option.value);
          }
        };
        collect(parse(english[key]));
      } catch {
        /* Invalid source ICU is already reported. */
      }
      const literalCopies = translatedLiterals.map(comparable).filter(Boolean);
      const copiedPlural = english[key].includes(", plural,") && literalCopies.length > 0 && literalCopies.every((part) => englishLiterals.includes(part));
      if (
        locale !== "en" &&
        (comparable(value) === comparable(english[key]) || copiedPlural) &&
        !invariants.brands.includes(value) &&
        !invariants.identicalTranslations[key]?.includes(locale) &&
        !notation
      )
        untranslated.push(key);
      if (locale !== "en" && (value.includes("⁇") || value.includes("�") || /(.{2,24})\1{5}/u.test(value))) errors.push({ locale, key, issue: "Malformed or repeated translation output" });
    }
    const translated = Object.keys(english).length - missing.length - untranslated.length;
    coverage[locale] = {
      translated,
      total: Object.keys(english).length,
      percent: +((translated / Math.max(1, Object.keys(english).length)) * 100).toFixed(2),
      missing,
      untranslated,
      nativeReview: locale === "en" ? "source" : "awaiting-native-review",
    };
  }
  const source = inventory(base);
  const technical = invariants.technicalSource ?? [];
  for (const file of source) for (const entry of file.translatedComparisons) errors.push({ file: file.file, ...entry });
  const hardcoded = source.flatMap((file) =>
    file.strings
      .filter(
        (entry) =>
          (file.file.startsWith("src/ui/")
            ? ["jsx", "attribute", "rendered-expression", "display-property", "public-error"].includes(entry.kind)
            : ["public-error", "rendered-expression"].includes(entry.kind)) &&
          !entry.technical &&
          !invariants.brands.includes(entry.text.trim()) &&
          !/^Meldiq by GriipBuddy$/.test(entry.text.trim()) &&
          !technical.some((rule) => rule.file === file.file && rule.text === entry.text && rule.reason),
      )
      .map((entry) => ({ file: file.file, ...entry })),
  );
  const standalone = publicInventory(base, english, invariants.brands);
  hardcoded.push(...standalone.hardcoded);
  errors.push(...standalone.errors);
  const accessibility = source.flatMap((file) => file.accessibility.map((entry) => ({ file: file.file, ...entry })));
  const complete =
    errors.length === 0 && hardcoded.length === 0 && accessibility.length === 0 && Object.values(coverage).every((locale) => locale.missing.length === 0 && locale.untranslated.length === 0);
  return {
    complete,
    errors,
    englishKeys: Object.keys(english).length,
    coverage,
    hardcodedCandidates: hardcoded,
    accessibilityCandidates: accessibility,
    scope:
      "Coverage counts the extracted static interface catalog. The source policy also audits render strings, attributes, public errors, standalone pages and accessible control labels. This is not professional linguistic approval or exhaustive dynamic-flow coverage.",
  };
}

if (process.argv[1] === import.meta.filename) {
  const report = validateCatalogs();
  const directory = path.join(root, "docs/i18n");
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "coverage.json"), JSON.stringify(report, null, 2) + "\n");
  console.table(
    Object.fromEntries(
      Object.entries(report.coverage).map(([locale, c]) => [
        locale,
        { translated: c.translated, total: c.total, coverage: `${c.percent}%`, missing: c.missing.length, untranslated: c.untranslated.length },
      ]),
    ),
  );
  console.log(`${report.errors.length} structural errors; ${report.hardcodedCandidates.length} hardcoded source candidates. Complete: ${report.complete}`);
  if (report.errors.length) console.error(JSON.stringify(report.errors.slice(0, 30), null, 2));
  const structural = process.argv.includes("--structure-only");
  process.exitCode = structural ? (report.errors.length ? 1 : 0) : report.complete ? 0 : 1;
}
