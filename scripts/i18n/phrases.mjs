import { parse, TYPE } from "@formatjs/icu-messageformat-parser";
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const namePatterns = new WeakMap();
/** Inspect literal prose only; ICU variables, product names, URLs and technical notation stay opaque. */
export function proseWords(message, names) {
  const parts = [];
  function walk(nodes) {
    for (const node of nodes) {
      if (node.type === TYPE.literal) parts.push(node.value);
      if (node.children) walk(node.children);
      if (node.options) for (const option of Object.values(node.options)) walk(option.value);
    }
  }
  try {
    walk(parse(message));
  } catch {
    return [];
  }
  let prose = parts.join(" ");
  let pattern = namePatterns.get(names);
  if (!pattern) {
    pattern = new RegExp(
      [...names]
        .sort((a, b) => b.length - a.length)
        .map(escapeRegExp)
        .join("|"),
      "gi",
    );
    namePatterns.set(names, pattern);
  }
  prose = prose.replace(pattern, " ");
  prose = prose.replace(/(?:https?:\/\/|www\.)\S+/g, " ").replace(/\b(?:API|URL|URI|IDs?|JSON|HTML|CSS|HTTP|HTTPS|WebRTC|RTC|CPU|RAM|UDP|TCP|GB|MB|KB|PNG|GIF|JPEG|PDF)\b/g, " ");
  return prose.match(/[A-Za-z]+/g)?.map((word) => word.toLowerCase()) ?? [];
}
export function fiveWordPhrases(message, names) {
  const words = proseWords(message, names);
  return words.slice(0, -4).map((_, index) => words.slice(index, index + 5).join(" "));
}
