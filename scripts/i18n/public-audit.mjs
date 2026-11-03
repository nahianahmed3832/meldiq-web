import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
/** Small standalone pages use the same catalog through build-derived local assets. */
export function publicInventory(base, english, brands) {
  const directory = path.join(base, "public"),
    hardcoded = [],
    errors = [];
  if (!fs.existsSync(directory)) return { hardcoded, errors };
  for (const name of ["invite.html", "social-auth-callback.html"]) {
    const file = path.join(directory, name);
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, "utf8");
    for (const match of html.matchAll(/data-public-text="([^"]+)"/g)) if (!(match[1] in english)) errors.push({ file: "public/" + name, key: match[1], issue: "Unknown standalone catalog key" });
    const stripped = html
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "");
    for (const match of stripped.matchAll(/>([^<>]+)</g)) {
      const text = match[1].trim();
      if (/[\p{L}]{2}/u.test(text) && !brands.includes(text)) hardcoded.push({ file: "public/" + name, kind: "standalone-html", text });
    }
  }
  for (const name of ["invite.js", "social-auth-callback.js", "boot.js"]) {
    const file = path.join(directory, name);
    if (!fs.existsSync(file)) continue;
    const sf = ts.createSourceFile(name, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    function collect(node) {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        const text = node.text;
        if (/[A-Za-z]{2}/.test(text) && !brands.includes(text))
          hardcoded.push({ file: "public/" + name, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, kind: "standalone-script", text });
      } else if (ts.isBinaryExpression(node)) {
        collect(node.left);
        collect(node.right);
      } else if (ts.isConditionalExpression(node)) {
        collect(node.whenTrue);
        collect(node.whenFalse);
      }
    }
    function visit(node) {
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isPropertyAccessExpression(node.left) &&
        (["textContent", "innerText"].includes(node.left.name.text) || node.left.getText(sf) === "document.title")
      )
        collect(node.right);
      ts.forEachChild(node, visit);
    }
    visit(sf);
  }
  return { hardcoded, errors };
}
