import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { z } from "zod";
import { WEB_ROOT } from "./serverDir";

/**
 * Every HTTP call the web makes, read from its source (src/**): `x.json("GET", path, schema)` decodes the answer with
 * `schema`, `x.call("POST", path)` ignores it. The table is derived, never written by hand, so a new call can't be missed.
 *
 * Schemas are rebuilt from their source text in the scope of the file that calls them (its imports, and its own top-level
 * declarations), so a module-private schema or an inline `z.object({ … })` is decoded exactly as written, without
 * exporting it or loading the calling module (some are React views or the service worker).
 */
export interface ApiCall {
  /** src-relative file and line. */
  at: string;
  method: string;
  /** Path templates with "{}" for each variable segment and no query; several when a helper chooses between paths. Empty when the path is a variable. */
  paths: string[];
  /** The schema's source text, for `.json` calls. */
  schema?: string;
  file: string;
}

const SRC = path.join(WEB_ROOT, "src");
const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(e.name) && !e.name.endsWith(".d.ts") ? [full] : [];
  });
}

const parsed = new Map<string, ts.SourceFile>();
function parse(file: string): ts.SourceFile {
  let sf = parsed.get(file);
  if (!sf) {
    sf = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.ES2022, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    parsed.set(file, sf);
  }
  return sf;
}

/** Top-level `const name = …` initializers and `function name() {…}` declarations of a file. */
function topLevel(sf: ts.SourceFile): Map<string, ts.Node> {
  const out = new Map<string, ts.Node>();
  for (const s of sf.statements) {
    if (ts.isVariableStatement(s)) for (const d of s.declarationList.declarations) if (ts.isIdentifier(d.name) && d.initializer) out.set(d.name.text, d.initializer);
    if (ts.isFunctionDeclaration(s) && s.name) out.set(s.name.text, s);
  }
  return out;
}

/** The expression a local path helper returns (`const base = (orgId) => \`/v1/orgs/${…}\``). */
function helperBody(sf: ts.SourceFile, name: string): ts.Expression | null {
  const node = topLevel(sf).get(name);
  if (node && ts.isArrowFunction(node) && !ts.isBlock(node.body)) return node.body;
  return null;
}

function paths(sf: ts.SourceFile, e: ts.Expression): string[] {
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return [e.text];
  if (ts.isParenthesizedExpression(e)) return paths(sf, e.expression);
  if (ts.isConditionalExpression(e)) return [...paths(sf, e.whenTrue), ...paths(sf, e.whenFalse)];
  if (ts.isCallExpression(e) && ts.isIdentifier(e.expression)) {
    const body = helperBody(sf, e.expression.text);
    return body ? paths(sf, body) : ["{}"];
  }
  if (ts.isTemplateExpression(e)) {
    let out = [e.head.text];
    for (const span of e.templateSpans) {
      const x = span.expression;
      const expands = ts.isConditionalExpression(x) || ts.isStringLiteral(x) || (ts.isCallExpression(x) && ts.isIdentifier(x.expression) && !!helperBody(sf, x.expression.text));
      const parts = expands ? paths(sf, x) : ["{}"];
      out = out.flatMap((o) => parts.map((p) => o + p + span.literal.text));
    }
    return out;
  }
  return ["{}"];
}

/** No query, and a "{}" glued to a literal segment (`/members${query}`) is a query too. */
function clean(p: string): string {
  return p
    .split("?")[0]
    .split("/")
    .map((s) => (s === "{}" ? s : s.replaceAll("{}", "")))
    .join("/");
}

export function apiCalls(): ApiCall[] {
  const calls: ApiCall[] = [];
  for (const file of sourceFiles(SRC)) {
    const sf = parse(file);
    const visit = (n: ts.Node): void => {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && ["json", "call"].includes(n.expression.name.text)) {
        const [m, p, schema] = n.arguments;
        if (m && ts.isStringLiteral(m) && METHODS.has(m.text) && p) {
          const decodes = n.expression.name.text === "json";
          const all = paths(sf, p).map(clean);
          calls.push({
            at: `${path.relative(SRC, file)}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`,
            method: m.text,
            paths: all.every((x) => x.startsWith("/")) ? all : [],
            schema: decodes && schema ? schema.getText(sf) : undefined,
            file,
          });
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return calls;
}

// ───────────────────────── schemas from source ─────────────────────────

type Scope = Map<string, () => Promise<unknown>>;
const scopes = new Map<string, Scope>();
const values = new Map<string, Promise<unknown>>();

function resolveModule(from: string, spec: string): string | null {
  if (!spec.startsWith(".")) return null;
  const base = path.resolve(path.dirname(from), spec);
  return [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")].find((f) => fs.existsSync(f) && fs.statSync(f).isFile()) ?? null;
}

/** JavaScript for a TypeScript expression or declaration (types, `as const`, `satisfies` removed). */
function js(text: string): string {
  return ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.trim();
}

function identifiers(node: ts.Node): Set<string> {
  const out = new Set<string>();
  const visit = (n: ts.Node): void => {
    if (ts.isIdentifier(n) && !(ts.isPropertyAccessExpression(n.parent) && n.parent.name === n) && !(ts.isPropertyAssignment(n.parent) && n.parent.name === n)) out.add(n.text);
    ts.forEachChild(n, visit);
  };
  visit(node);
  return out;
}

/** The values a file's code can name: its imports (loaded from their modules) and its own top-level declarations. */
function scopeOf(file: string): Scope {
  let scope = scopes.get(file);
  if (scope) return scope;
  scope = new Map();
  scopes.set(file, scope);
  const sf = parse(file);
  scope.set("z", async () => z);
  for (const s of sf.statements) {
    if (!ts.isImportDeclaration(s) || !ts.isStringLiteral(s.moduleSpecifier) || s.importClause?.isTypeOnly) continue;
    const spec = s.moduleSpecifier.text;
    const target = resolveModule(file, spec);
    const load = () => (target ? import(target) : import(spec)) as Promise<Record<string, unknown>>;
    const named = s.importClause?.namedBindings;
    if (named && ts.isNamedImports(named)) for (const el of named.elements) if (!el.isTypeOnly) scope.set(el.name.text, async () => (await load())[(el.propertyName ?? el.name).text]);
    if (named && ts.isNamespaceImport(named)) scope.set(named.name.text, load);
    if (s.importClause?.name) scope.set(s.importClause.name.text, async () => (await load()).default);
  }
  for (const [name, node] of topLevel(sf)) {
    const s = scope;
    s.set(name, () => {
      const key = `${file}#${name}`;
      let v = values.get(key);
      if (!v) {
        const text = ts.isFunctionDeclaration(node) ? node.getText(sf).replace(/^export\s+/, "") : node.getText(sf);
        v = evaluate(file, node, js(`(${text})`).replace(/;$/, ""));
        values.set(key, v);
      }
      return v;
    });
  }
  return scope;
}

async function evaluate(file: string, node: ts.Node, code: string): Promise<unknown> {
  const scope = scopeOf(file);
  const names = [...identifiers(node)].filter((n) => scope.has(n));
  const args = await Promise.all(names.map((n) => scope.get(n)!()));
  return new Function(...names, `return ${code};`)(...args) as unknown;
}

/** The schema a `.json` call decodes with, built from its source text in its file's scope. */
export async function schemaOf(call: ApiCall): Promise<z.ZodTypeAny> {
  const expr = ts.createSourceFile("x.ts", `(${call.schema!})`, ts.ScriptTarget.ES2022, true);
  const v = await evaluate(call.file, expr, js(`(${call.schema!})`).replace(/;$/, ""));
  if (!(v instanceof z.ZodType)) throw new Error(`${call.at}: ${call.schema} isn't a zod schema`);
  return v;
}
