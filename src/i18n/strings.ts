/** Compatibility type for the original keys; dictionaries live in locales/<locale>/<namespace>.json. */
import type keys from "./legacy-keys.json";
export type StringKey = keyof typeof keys;
