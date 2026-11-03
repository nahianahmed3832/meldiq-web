import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LANGUAGES, matchLanguage } from "../src/i18n/languages";
// @ts-expect-error -- build-only JavaScript is exercised against its emitted browser script.
import { writePublicLocaleAssets } from "../scripts/i18n/public-assets.mjs";
const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});
function assets() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "meldiq-public-i18n-"));
  directories.push(directory);
  for (const file of ["invite.html", "social-auth-callback.html", "social-auth-callback.js"]) fs.copyFileSync(path.resolve("public", file), path.join(directory, file));
  const report = writePublicLocaleAssets(directory, { fillEnglish: true });
  return { directory, report, script: fs.readFileSync(path.join(directory, "public-locale.js"), "utf8") };
}
async function runtime(language: string) {
  const { directory, report, script } = assets();
  const root: { lang?: string; dir?: string } = {};
  const window: Record<string, unknown> = { dispatchEvent: () => {} };
  const fetch = vi.fn(async (url: string) => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(directory, url), "utf8")) }));
  const context = {
    window,
    document: { documentElement: root, querySelectorAll: () => [], getElementById: () => null },
    localStorage: { getItem: () => null },
    navigator: { languages: [language] },
    Intl,
    CustomEvent: class {},
    fetch,
  };
  vm.runInNewContext(script, context);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const api = window.meldiqPublicI18n as {
    choose: (locale: string) => Promise<boolean>;
    match: (tag: string) => string | null;
    text: (key: string, values?: Record<string, string | number>) => string;
    keys: Record<string, string>;
  };
  return { api, root, directory, report, fetch };
}
describe("standalone localization assets", () => {
  it("shares all 28 locale matches and regional detection with the application", async () => {
    const { api, root, report, fetch } = await runtime("pt");
    expect(report.locales).toBe(28);
    expect(root.lang).toBe("pt-PT");
    await api.choose("en");
    await api.choose("pt-PT");
    expect(fetch).toHaveBeenCalledTimes(1);
    for (const tag of [...LANGUAGES, "zh-Hant-HK", "zh-Hans-TW", "pt", "pt-AO", "es-MX", "es", "bad", "en_US"]) expect(api.match(tag) ?? undefined).toBe(matchLanguage(tag));
  });
  it("emits an English HTML fallback and formats native public counts without changing user variables", async () => {
    const { api, root, directory } = await runtime("ar");
    expect(root.dir).toBe("rtl");
    expect(api.text(api.keys.members, { count: 12 })).toContain(new Intl.NumberFormat("ar").format(12));
    const html = fs.readFileSync(path.join(directory, "invite.html"), "utf8");
    expect(html).toContain("Join in Meldiq Web");
    expect(html).toContain("Copy the code");
    const callback = fs.readFileSync(path.join(directory, "social-auth-callback.html"), "utf8");
    expect(callback).toContain("Finishing sign-in…");
    expect(callback).toMatch(/src="\/locales\/social-auth-callback-[a-f0-9]+\.js"/);
    expect(fs.existsSync(path.join(directory, "social-auth-callback.js"))).toBe(false);
    const payloads = fs
      .readdirSync(path.join(directory, "locales"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    expect(payloads.sort()).toEqual([...LANGUAGES].sort());
  });
});
