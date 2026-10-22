import type { AtRule, Declaration, Plugin, Root, Rule } from "postcss";
import type postcssDefault from "postcss";

/** The node builders this step needs (passed in, so the config and the tests share one PostCSS). */
type Builders = Pick<typeof postcssDefault, "rule" | "decl" | "atRule">;

/**
 * Colours for browsers without CSS light-dark() (Safari and iOS before 17.5, so every iPhone 8; docs/MELDIQ_WEB_BROWSERS.md).
 *
 * src/styles/tokens.css writes each colour token once, as light-dark(light, dark), inside
 * `@supports (color: light-dark(#000, #fff))`. This build step adds the same tokens for every other browser, in
 * `@supports not (…)`: the light values, then the dark ones for the system's dark mode (unless Meldiq is set to light)
 * and for Meldiq's own dark setting. Specificity keeps the palettes working: `:root[data-palette="plum"]` beats `:root`,
 * and every dark rule is one attribute or pseudo-class more specific than its light one.
 */
const SUPPORTS = /light-dark\(/;
const CALL = "light-dark(";

/** [value] with each light-dark(a, b) replaced by a ([side] 0) or b (1). Null when there's none. */
export function resolveLightDark(value: string, side: 0 | 1): string | null {
  if (!value.includes(CALL)) return null;
  let out = "";
  let i = 0;
  while (i < value.length) {
    const at = value.indexOf(CALL, i);
    if (at < 0) {
      out += value.slice(i);
      break;
    }
    out += value.slice(i, at);
    let depth = 1;
    let j = at + CALL.length;
    let comma = -1;
    for (; j < value.length && depth > 0; j++) {
      const ch = value[j];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      else if (ch === "," && depth === 1 && comma < 0) comma = j;
    }
    if (depth !== 0 || comma < 0) throw new Error(`Malformed light-dark() in: ${value}`);
    const args = [value.slice(at + CALL.length, comma), value.slice(comma + 1, j - 1)].map((a) => a.trim());
    // A nested light-dark() inside one side is resolved the same way.
    out += resolveLightDark(args[side], side) ?? args[side];
    i = j;
  }
  return out;
}

const lightDarkDecls = (rule: Rule): Declaration[] => (rule.nodes ?? []).filter((n): n is Declaration => n.type === "decl" && n.value.includes(CALL));

/** The fallback rules for one light-dark() @supports block. */
function fallbackFor(block: AtRule, postcss: Builders): AtRule {
  const light: Rule[] = [];
  const systemDark: Rule[] = [];
  const chosenDark: Rule[] = [];
  block.walkRules((rule) => {
    const decls = lightDarkDecls(rule);
    if (!decls.length) {
      light.push(rule.clone()); // color-scheme and the like: as they are
      return;
    }
    const side = (s: 0 | 1, selectors: string[]) => postcss.rule({ selectors, nodes: decls.map((d) => postcss.decl({ prop: d.prop, value: resolveLightDark(d.value, s)!, important: d.important })) });
    light.push(side(0, rule.selectors));
    systemDark.push(
      side(
        1,
        rule.selectors.map((sel) => `${sel}:not([data-theme="light"])`),
      ),
    );
    chosenDark.push(
      side(
        1,
        rule.selectors.map((sel) => `${sel}[data-theme="dark"]`),
      ),
    );
  });
  const media = postcss.atRule({ name: "media", params: "(prefers-color-scheme: dark)", nodes: systemDark });
  return postcss.atRule({ name: "supports", params: "not (color: light-dark(#000, #fff))", nodes: [...light, media, ...chosenDark] });
}

export function lightDarkFallback(postcss: Builders): Plugin {
  return {
    postcssPlugin: "meldiq-light-dark-fallback",
    Once(root: Root) {
      root.walkAtRules("supports", (at) => {
        if (!SUPPORTS.test(at.params) || /\bnot\b/.test(at.params)) return;
        at.after(fallbackFor(at, postcss));
      });
    },
  };
}
