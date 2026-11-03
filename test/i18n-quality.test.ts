import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

function evaluate(code: string, argument: unknown): unknown {
  return JSON.parse(
    execFileSync(process.execPath, ["--input-type=module", "-e", code, JSON.stringify(argument)], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 32 * 1024 * 1024 }),
  );
}
const signatureCode = 'import {messageSignature} from "./scripts/i18n/check.mjs"; const {message,locale}=JSON.parse(process.argv[1]); console.log(JSON.stringify(messageSignature(message,locale)));';

describe("localization quality gate", () => {
  it("detects invalid plural grammar and changed placeholder types", () => {
    const signature = (message: string, locale = "en") => evaluate(signatureCode, { message, locale });
    expect(signature("Hello {name}")).toBe(signature("Hallo {name}", "de"));
    expect(signature("{count, number}")).not.toBe(signature("{count}"));
    expect(() => signature("{count, plural, one {One}}")).toThrow();
    expect(() => signature("{count, plural, zero {None} other {#}}", "de")).toThrow();
    expect(signature("{count, plural, zero {لا شيء} one {واحد} two {اثنان} few {#} many {#} other {#}}", "ar")).toBeTypeOf("string");
  });
  it("reports missing files, invalid JSON, unexpected keys, empty text, placeholders, untranslated values and unlabeled icon buttons", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "meldiq-i18n-quality-"));
    try {
      fs.cpSync("locales", path.join(directory, "locales"), { recursive: true });
      fs.mkdirSync(path.join(directory, "src/ui"), { recursive: true });
      fs.writeFileSync(
        path.join(directory, "src/ui/Demo.tsx"),
        'function counted(n,label){return `${n} ${label}`;} export function Demo({message,kind}) {const translatedIdentifier=kind===uiText("common.actions.save"); const field={ariaLabel:"Card number"}; fail("Payment failed"); return <><button className="icon-btn"><X /></button><p>{message.text}</p><p>Save changes</p><Way pays="Reward for a visit" now="Counted today" /><p>{counted(2,"helpers")}</p></>;}',
      );
      fs.mkdirSync(path.join(directory, "public"), { recursive: true });
      fs.writeFileSync(path.join(directory, "public/invite.html"), '<h1>Untranslated invitation</h1><p data-public-text="auth.missingPublic"></p>');
      fs.writeFileSync(path.join(directory, "public/invite.js"), 'document.title="Hardcoded public title";');
      fs.unlinkSync(path.join(directory, "locales/ko/auth.json"));
      fs.writeFileSync(path.join(directory, "locales/ja/common.json"), "invalid JSON");
      const file = path.join(directory, "locales/bn/common.json");
      const dictionary = JSON.parse(fs.readFileSync(file, "utf8"));
      dictionary.actions.save = "";
      dictionary.actions.close = "关闭";
      dictionary.actions.cancel = "বাংলা and শব্দ";
      dictionary.actions.copy = "Copy";
      dictionary.unexpected = "অতিরিক্ত";
      fs.writeFileSync(file, JSON.stringify(dictionary));
      const auth = path.join(directory, "locales/bn/auth.json");
      const strings = JSON.parse(fs.readFileSync(auth, "utf8"));
      strings.verify_sent = "ইমেইল {address}";
      strings.hero_body = "স্থানীয় নাম";
      strings.signin_enter_password = "Enter পাসওয়ার্ড";
      strings.hero_point_remove = "ব্রাউজার Remove this browser from any of your devices at any time; it signs out at once.";
      fs.writeFileSync(auth, JSON.stringify(strings));
      const arabicFile = path.join(directory, "locales/ar/common.json");
      const arabic = JSON.parse(fs.readFileSync(arabicFile, "utf8"));
      arabic.counts.members = "{count, plural, zero {# members} one {# member} two {# members} few {# members} many {# members} other {# members}}";
      fs.writeFileSync(arabicFile, JSON.stringify(arabic));
      const arabicSettingsFile = path.join(directory, "locales/ar/settings.json");
      const arabicSettings = JSON.parse(fs.readFileSync(arabicSettingsFile, "utf8"));
      arabicSettings.ap_animoji_sub = "OFF: رموز ثابتةName";
      fs.writeFileSync(arabicSettingsFile, JSON.stringify(arabicSettings));
      const workspaceFile = path.join(directory, "locales/bn/workspace.json");
      const workspace = JSON.parse(fs.readFileSync(workspaceFile, "utf8"));
      workspace.interface.messages_to_and_from_are_paused_this_happens_when_someone_reinsta_3847164 = "Meldiq <slot0></slot0> <slot0></slot0>";
      fs.writeFileSync(workspaceFile, JSON.stringify(workspace));
      const result = evaluate('import {validateCatalogs} from "./scripts/i18n/check.mjs"; console.log(JSON.stringify(validateCatalogs(JSON.parse(process.argv[1]))));', directory) as {
        complete: boolean;
        errors: { issue: string; file?: string; locale?: string; key?: string }[];
        coverage: Record<string, { untranslated: string[] }>;
        hardcodedCandidates: { text: string }[];
        accessibilityCandidates: unknown[];
      };
      expect(result.complete).toBe(false);
      expect(result.errors.some((error) => error.issue === "Stray translation suffix")).toBe(true);
      expect(result.errors.some((error) => error.issue === "Untranslated English connective in native prose")).toBe(true);
      expect(result.errors.some((error) => error.issue === "Unexpected writing system in translation")).toBe(true);
      expect(result.errors.some((error) => error.issue === "Untranslated text-entry instruction")).toBe(true);
      expect(result.errors.some((error) => error.issue === "Untranslated on/off state label")).toBe(true);
      expect(result.errors.some((error) => error.issue === "Unknown standalone catalog key")).toBe(true);
      expect(result.errors.some((error) => error.issue.includes("inline placeholder multiplicity"))).toBe(true);
      expect(result.errors.some((error) => error.issue.includes("control-flow identifier"))).toBe(true);
      expect(result.errors.some((error) => error.file?.endsWith("ko/auth.json"))).toBe(true);
      expect(result.errors.some((error) => error.file?.endsWith("ja/common.json"))).toBe(true);
      expect(result.errors.some((error) => error.issue === "Empty translation")).toBe(true);
      expect(result.errors.some((error) => error.issue === "Unexpected key")).toBe(true);
      expect(result.errors.some((error) => error.issue.includes("Mismatched interpolation"))).toBe(true);
      expect(result.coverage.bn.untranslated).toContain("common.actions.copy");
      expect(result.errors.some((error) => error.issue.includes("Changed protected product name"))).toBe(true);
      expect(result.errors.some((error) => error.key === "auth.hero_point_remove" && error.issue.startsWith("Untranslated English phrase:"))).toBe(true);
      expect(result.coverage.ar.untranslated).toContain("common.counts.members");
      expect(result.hardcodedCandidates.map((entry) => entry.text)).toEqual([
        "Card number",
        "Payment failed",
        "Save changes",
        "Reward for a visit",
        "Counted today",
        "helpers",
        "Untranslated invitation",
        "Hardcoded public title",
      ]);
      expect(result.accessibilityCandidates).toHaveLength(1);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
