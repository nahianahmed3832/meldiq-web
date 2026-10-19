import fs from "node:fs";
import path from "node:path";

/** The newest code emailed to [to] by the test server (MAIL_TRANSPORT=file writes one .eml per message). */
export async function emailedCode(to: string, kind: "verify" | "reset", timeoutMs = 10_000): Promise<string> {
  const dir = path.join(process.env.ORBIT_E2E_DATA!, "mail");
  const pattern = kind === "verify" ? /\b(\d{6})\b/ : /\b([A-Z2-9]{5}-[A-Z2-9]{5})\b/;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const files = fs.existsSync(dir)
      ? fs
          .readdirSync(dir)
          .filter((f) => f.endsWith(".eml"))
          .sort()
          .reverse()
      : [];
    for (const f of files) {
      const text = fs.readFileSync(path.join(dir, f), "utf8");
      if (!text.includes(`To: ${to}`)) continue;
      const code = text.split("\n\n").slice(1).join("\n\n").match(pattern)?.[1];
      if (code) return code;
    }
    if (Date.now() > deadline) throw new Error(`no ${kind} code emailed to ${to}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}
