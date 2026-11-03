import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

export const root = path.resolve(import.meta.dirname, "../..");
export const displayProps = new Set([
  "title",
  "label",
  "aria-label",
  "aria-description",
  "placeholder",
  "alt",
  "hint",
  "subtitle",
  "description",
  "emptyText",
  "heading",
  "sub",
  "text",
  "message",
  "note",
  "caption",
  "body",
  "empty",
  "none",
  "allowNone",
  "line",
  "submitLabel",
  "aria-valuetext",
  "ariaLabel",
  "ariaDescription",
  "ariaInvalidErrorMessage",
  "emptyLabel",
  "busyLabel",
  "errorLabel",
  "loadingLabel",
  "primaryLabel",
  "secondaryLabel",
  "searchPlaceholder",
  "confirmLabel",
  "replyName",
  "senderLabel",
  "recipientLabel",
  "fallbackName",
  "emptyMessage",
  "errorMessage",
  "statusText",
  "tooltip",
  "buttonText",
  "actionText",
  "helperText",
  "fallbackText",
  "defaultLabel",
  "pays",
  "now",
  "cancelLabel",
]);

export function filesIn(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const name = path.join(dir, entry.name);
      return entry.isDirectory() ? filesIn(name) : [name];
    })
    .sort();
}

export function jsxText(raw) {
  // React's JSX whitespace rules: trim indentation, retain spaces on the same line.
  const lines = raw.replace(/\r/g, "").split("\n");
  const nonempty = lines
    .map((line, i) => {
      let text = line.replace(/\t/g, " ");
      if (i > 0) text = text.trimStart();
      if (i < lines.length - 1) text = text.trimEnd();
      return text;
    })
    .filter(Boolean);
  return nonempty.join(" ").replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_, entity) => {
    if (entity.startsWith("#x")) return String.fromCodePoint(parseInt(entity.slice(2), 16));
    if (entity.startsWith("#")) return String.fromCodePoint(Number(entity.slice(1)));
    return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0" }[entity];
  });
}

function textLike(text) {
  return /[A-Za-z]{2}/.test(text) && !/^(https?:|\/[\w/]|[\w.-]+\.(svg|png|webp|mp4)$)/.test(text);
}

export function inventory(base = root) {
  const files = filesIn(path.join(base, "src")).filter((name) => /\.(ts|tsx)$/.test(name));
  return files.map((absolute) => {
    const file = path.relative(base, absolute);
    const source = ts.createSourceFile(file, fs.readFileSync(absolute, "utf8"), ts.ScriptTarget.Latest, true);
    const strings = [];
    const seen = new Set();
    const components = [];
    const accessibility = [];
    const translatedComparisons = [];
    const add = (node, text, kind) => {
      if (textLike(text)) {
        const identity = node.getStart(source) + "/" + kind;
        if (seen.has(identity)) return;
        seen.add(identity);
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        let code = false;
        for (let parent = node.parent; parent; parent = parent.parent) if (ts.isJsxElement(parent) && ["code", "pre", "kbd"].includes(parent.openingElement.tagName.getText(source))) code = true;
        strings.push({ line, start: node.getStart(source), end: node.end, kind, text, ...(code ? { technical: "Literal code example or keyboard notation" } : {}) });
      }
    };
    const bindings = new Map();
    const scopeOf = (node) => {
      for (let parent = node.parent; parent; parent = parent.parent) if (ts.isBlock(parent) || ts.isFunctionLike(parent) || ts.isSourceFile(parent)) return parent;
      return source;
    };
    const bind = (name, value, scope) => {
      if (!bindings.has(name)) bindings.set(name, []);
      bindings.get(name).push({ value, scope });
    };
    const register = (node) => {
      if (ts.isFunctionDeclaration(node) && node.name) bind(node.name.text, node, scopeOf(node));
      if ((ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node)) && ts.isIdentifier(node.name) && node.initializer)
        bind(node.name.text, node.initializer, scopeOf(node));
      ts.forEachChild(node, register);
    };
    register(source);
    const activeCalls = [];
    const resolve = (identifier) =>
      [...(bindings.get(identifier.text) ?? []), ...activeCalls.flatMap((call) => call.parameters.filter((parameter) => parameter.name === identifier.text))]
        .filter((entry) => entry.scope.pos <= identifier.pos && entry.scope.end >= identifier.end)
        .sort((a, b) => a.scope.end - a.scope.pos - (b.scope.end - b.scope.pos))[0]?.value;
    let renderedNodes = new Set();
    const renderedFunction = (node, args = []) => {
      if (!node.body || activeCalls.some((call) => call.node === node)) return;
      const previousNodes = renderedNodes;
      renderedNodes = new Set();
      activeCalls.push({
        node,
        parameters: node.parameters.flatMap((parameter, index) => (ts.isIdentifier(parameter.name) && args[index] ? [{ name: parameter.name.text, value: args[index], scope: node }] : [])),
      });
      try {
        if (!ts.isBlock(node.body)) return rendered(node.body);
        const returns = (child) => {
          if (ts.isReturnStatement(child) && child.expression) rendered(child.expression);
          else if (!ts.isFunctionLike(child)) ts.forEachChild(child, returns);
        };
        ts.forEachChild(node.body, returns);
      } finally {
        activeCalls.pop();
        renderedNodes = previousNodes;
      }
    };
    const rendered = (node) => {
      if (renderedNodes.has(node)) return;
      renderedNodes.add(node);

      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) add(node, node.text, "rendered-expression");
      else if (ts.isTemplateExpression(node)) {
        const parts = [node.head.text, ...node.templateSpans.map((span) => span.literal.text)];
        if (parts.some(textLike)) add(node, node.getText(source), "rendered-expression");
        for (const span of node.templateSpans) rendered(span.expression);
      } else if (ts.isConditionalExpression(node)) {
        rendered(node.whenTrue);
        rendered(node.whenFalse);
      } else if (ts.isBinaryExpression(node) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(node.operatorToken.kind)) {
        rendered(node.left);
        rendered(node.right);
      } else if (ts.isParenthesizedExpression(node)) rendered(node.expression);
      else if (ts.isArrayLiteralExpression(node)) {
        for (const element of node.elements) rendered(element);
      } else if (ts.isIdentifier(node)) {
        for (let parent = node.parent; parent; parent = parent.parent) if (ts.isJsxElement(parent) && ["code", "pre", "kbd"].includes(parent.openingElement.tagName.getText(source))) return;
        const value = resolve(node);
        if (value) rendered(value);
      } else if (ts.isCallExpression(node) && /^(?:uiText|l10n|t|text)$/.test(node.expression.getText(source))) {
        for (const arg of node.arguments.slice(1)) if (ts.isObjectLiteralExpression(arg)) for (const field of arg.properties) if (ts.isPropertyAssignment(field)) rendered(field.initializer);
      } else if (ts.isArrowFunction(node)) {
        if (!ts.isBlock(node.body)) rendered(node.body);
        else for (const statement of node.body.statements) if (ts.isReturnStatement(statement) && statement.expression) rendered(statement.expression);
      } else if (ts.isCallExpression(node) && !ts.isJsxAttribute(node.parent?.parent) && node.arguments.some(ts.isArrowFunction)) {
        for (const arg of node.arguments) if (ts.isArrowFunction(arg)) rendered(arg);
      } else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        let code = false;
        for (let parent = node.parent; parent; parent = parent.parent) if (ts.isJsxElement(parent) && ["code", "pre", "kbd"].includes(parent.openingElement.tagName.getText(source))) code = true;
        const fn = resolve(node.expression);
        if (!code && fn && (ts.isFunctionDeclaration(fn) || ts.isFunctionExpression(fn) || ts.isArrowFunction(fn))) renderedFunction(fn, node.arguments);
      }
    };
    function walk(node) {
      if (ts.isCallExpression(node) && /^(?:uiText|l10n|t)$/.test(node.expression.getText(source))) {
        let parent = node.parent;
        while (ts.isParenthesizedExpression(parent)) parent = parent.parent;
        if (
          (ts.isBinaryExpression(parent) &&
            [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(
              parent.operatorToken.kind,
            )) ||
          ts.isCaseClause(parent)
        )
          translatedComparisons.push({
            line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
            issue: "Translated display value used as a control-flow identifier",
            expression: parent.getText(source),
          });
      }
      if (ts.isCallExpression(node)) {
        const target = node.expression.getText(source);
        if (/^(?:setError|setNotice|setWarning|setSuccess|setStatusMessage|setMessage|alert|confirm|prompt|fail)$|\.fail$/.test(target)) for (const arg of node.arguments) rendered(arg);
        if (/\.notice$/.test(target)) for (const arg of node.arguments.slice(1)) rendered(arg);
      }
      if (ts.isCallExpression(node) && /^(?:uiText|l10n|t|text)$/.test(node.expression.getText(source))) rendered(node);
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === "button") {
        const props = node.openingElement.attributes.properties.filter(ts.isJsxAttribute);
        const iconButton = props.some(
          (prop) => prop.name.getText(source) === "className" && prop.initializer && ts.isStringLiteral(prop.initializer) && prop.initializer.text.split(/\s+/).includes("icon-btn"),
        );
        const named = props.some((prop) => ["aria-label", "aria-labelledby", "title"].includes(prop.name.getText(source)));
        const children = node.children.filter((child) => !ts.isJsxText(child) || jsxText(child.text).trim());
        if (iconButton && !named && children.length && children.every(ts.isJsxSelfClosingElement))
          accessibility.push({ line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, issue: "Icon button has no explicit accessible label; review child semantics" });
      }
      if (ts.isFunctionDeclaration(node) && node.name && /^[A-Z]/.test(node.name.text)) components.push(node.name.text);
      if (ts.isJsxText(node)) add(node, jsxText(node.text), "jsx");
      if (ts.isJsxAttribute(node) && displayProps.has(node.name.getText(source)) && node.initializer && ts.isStringLiteral(node.initializer)) add(node.initializer, node.initializer.text, "attribute");
      if (ts.isPropertyAssignment(node) && displayProps.has(node.name.getText(source).replace(/^['"]|['"]$/g, ""))) rendered(node.initializer);
      if (ts.isJsxAttribute(node) && node.name.getText(source) === "value" && /^[A-Z]/.test(node.parent.parent.tagName.getText(source))) {
        if (node.initializer && ts.isStringLiteral(node.initializer)) add(node.initializer, node.initializer.text, "attribute");
        else if (node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) rendered(node.initializer.expression);
      }
      if (ts.isJsxAttribute(node) && node.name.getText(source) === "name" && /^(?:Avatar|UserAvatar|LookAvatar|OrgAvatar)$/.test(node.parent.parent.tagName.getText(source))) {
        if (node.initializer && ts.isStringLiteral(node.initializer)) add(node.initializer, node.initializer.text, "attribute");
        else if (node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) rendered(node.initializer.expression);
      }
      if (ts.isJsxExpression(node)) {
        if (node.expression && (!ts.isJsxAttribute(node.parent) || displayProps.has(node.parent.name.getText(source)) || node.parent.name.getText(source) === "slots")) rendered(node.expression);
        const visitExpression = (child) => {
          if (ts.isStringLiteral(child)) add(child, child.text, "expression-candidate");
          if (ts.isTemplateExpression(child)) add(child, child.getText(source), "template-candidate");
          // Call arguments and object literals can be identifiers, CSS, routes or user data: report separately.
          if (!ts.isCallExpression(child) && !ts.isObjectLiteralExpression(child) && !ts.isArrowFunction(child) && !ts.isJsxElement(child) && !ts.isJsxSelfClosingElement(child))
            ts.forEachChild(child, visitExpression);
        };
        if (node.expression) visitExpression(node.expression);
      }
      if (ts.isNewExpression(node) && /(?:Error|BackupUnsent|KeepLater)$/.test(node.expression.getText(source)))
        for (const argument of node.arguments ?? []) if (ts.isStringLiteral(argument) && /^[A-Z][\s\S]*\s[a-z]/.test(argument.text)) add(argument, argument.text, "public-error");
      ts.forEachChild(node, walk);
    }
    walk(source);
    return { file, components, strings, accessibility, translatedComparisons, review: "inventory-classified-by-source-policy; see coverage.json for unresolved render candidates" };
  });
}

if (process.argv[1] === import.meta.filename) {
  const report = inventory();
  fs.mkdirSync(path.join(root, "docs/i18n"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "docs/i18n/source-inventory.json"),
    JSON.stringify({ scope: "All src TypeScript files. Candidates require semantic review; dynamic backend/user data is not translated.", files: report }, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      files: report.length,
      uiFiles: report.filter((r) => r.file.startsWith("src/ui/")).length,
      components: report.reduce((n, r) => n + r.components.length, 0),
      candidates: report.reduce((n, r) => n + r.strings.length, 0),
    }),
  );
}
