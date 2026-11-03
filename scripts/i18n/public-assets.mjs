import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { parse, TYPE } from "@formatjs/icu-messageformat-parser";
import { LANGUAGES, LANGUAGE_NAMES } from "../../src/i18n/languages.ts";
import { publicLocaleRuntime } from "./public-runtime.mjs";
export const PUBLIC_KEYS = {
  language: "common.language.label",
  failed: "common.language.failed",
  loading: "common.status.loading",
  copied: "common.common_copied",
  members: "common.counts.members",
  back: "auth.interface.back_to_meldiq_f59db13",
  lead: "workspace.interface.you_ve_been_invited_to_join_1c4ddf0",
  invitation: "onboarding.public.invitation",
  community: "onboarding.public.community",
  copy: "onboarding.public.copy",
  web: "onboarding.public.web",
  app: "onboarding.public.app",
  android: "onboarding.public.android",
  title: "onboarding.public.title",
  hint: "onboarding.public.hint",
  finishing: "auth.public.finishing",
  returnTab: "auth.public.returnTab",
  orphan: "auth.public.orphan",
  invalid: "errors.api.invite_not_found",
  expired: "errors.api.invite_expired",
  revoked: "errors.api.invite_revoked",
  used: "errors.api.invite_used_up",
  paused: "errors.api.invites_paused",
  generic: "errors.generic",
};
const root = path.resolve(import.meta.dirname, "../..");
function lookup(object, parts) {
  for (const part of parts) object = object?.[part];
  return object;
}
function compile(message) {
  const parts = (nodes) =>
    nodes.map((node) => {
      if (node.type === TYPE.literal) return node.value;
      if (node.type === TYPE.argument || node.type === TYPE.number) return { argument: node.value };
      if (node.type === TYPE.pound) return { pound: true };
      throw new Error("Standalone copy must use plain arguments or a count plural");
    });
  const nodes = parse(message);
  if (nodes.length === 1 && nodes[0].type === TYPE.plural) {
    const plural = nodes[0];
    assert(!plural.offset);
    return { kind: "plural", argument: plural.value, options: Object.fromEntries(Object.entries(plural.options).map(([category, option]) => [category, parts(option.value)])) };
  }
  return { kind: "text", parts: parts(nodes) };
}
export function writePublicLocaleAssets(destination, { fillEnglish = false } = {}) {
  const dictionaries = {};
  for (const locale of LANGUAGES) {
    const namespaces = {};
    dictionaries[locale] = {};
    for (const key of Object.values(PUBLIC_KEYS)) {
      const [namespace, ...parts] = key.split(".");
      namespaces[namespace] ??= JSON.parse(fs.readFileSync(path.join(root, "locales", locale, namespace + ".json"), "utf8"));
      const message = lookup(namespaces[namespace], parts);
      // The English fallback remains available during authoring; strict i18n:check blocks incomplete releases.
      if (message !== undefined) dictionaries[locale][key] = compile(message);
      else if (locale === "en") throw new Error("Missing standalone source key: " + key);
    }
  }
  const files = {};
  for (const locale of LANGUAGES) {
    const json = JSON.stringify({ ...dictionaries.en, ...dictionaries[locale] }) + "\n",
      hash = crypto.createHash("sha256").update(json).digest("hex").slice(0, 16);
    const relative = `locales/${locale}/public-${hash}.json`;
    files[locale] = "/" + relative;
    fs.mkdirSync(path.join(destination, "locales", locale), { recursive: true });
    fs.writeFileSync(path.join(destination, relative), json);
  }
  const data = { english: dictionaries.en, locales: LANGUAGES, names: LANGUAGE_NAMES, keys: PUBLIC_KEYS, files };
  const runtime = `(${publicLocaleRuntime.toString()})(${JSON.stringify(data)});\n`;
  fs.writeFileSync(path.join(destination, "public-locale.js"), runtime);
  const runtimeHash = crypto.createHash("sha256").update(runtime).digest("hex").slice(0, 16);
  const runtimePath = `locales/public-runtime-${runtimeHash}.js`;
  fs.writeFileSync(path.join(destination, runtimePath), runtime);
  const scripts = { "public-locale.js": runtimePath };
  for (const name of ["invite.js", "social-auth-callback.js"]) {
    const source = fs.readFileSync(path.join(root, "public", name));
    const hash = crypto.createHash("sha256").update(source).digest("hex").slice(0, 16);
    const relative = `locales/${name.slice(0, -3)}-${hash}.js`;
    fs.writeFileSync(path.join(destination, relative), source);
    scripts[name] = relative;
  }

  if (fillEnglish) {
    const englishText = (key) => {
      const entry = dictionaries.en[key];
      assert(entry?.kind === "text" && entry.parts.every((part) => typeof part === "string"));
      return entry.parts.join("").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    };
    for (const name of ["invite.html", "social-auth-callback.html"]) {
      const file = path.join(destination, name);
      let html = fs.readFileSync(file, "utf8");
      html = html.replace(/(<([a-z][\w-]*)\b[^>]*\bdata-public-text="([^"]+)"[^>]*>)[^<]*(<\/\2>)/gi, (_, start, _tag, key, end) => start + englishText(key) + end);
      for (const [name, relative] of Object.entries(scripts)) html = html.replaceAll(`src="/${name}"`, `src="/${relative}"`);
      fs.writeFileSync(file, html);
    }
  }
  return { locales: LANGUAGES.length, keys: Object.keys(dictionaries.en).length, files };
}
if (process.argv[1] === import.meta.filename) writePublicLocaleAssets(path.resolve(process.argv[2] || path.join(root, "public")));
