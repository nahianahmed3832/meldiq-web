/** Literal examples and document references are technical data, never translator-authored text. */
export const MARKDOWN_SYNTAX = "**bold**, *italic*, - item, [link](https://…)";
export const SEARCH_SYNTAX = "from:name, mentions:me, in:channel, is:pinned, has:image, has:video, has:file, has:link, before:2026-10-01, during:2026-10-01, after:2026-10-01";
export const SEARCH_FILTER_TOKENS = { during: "during:", mentions: "mentions:", channel: "in:" } as const;
export const SERVER_REFERENCE = { path: "docs/SETTINGS_PARITY_API.md", login: "Log in with Meldiq", bots: "Bots" } as const;
