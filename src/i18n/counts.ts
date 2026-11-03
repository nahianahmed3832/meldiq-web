import { text } from "./index";
import type { ENGLISH } from "./english";

/** A number and its noun are one phrase; CLDR chooses every locale's grammatical form. */
export function countLabel(count: number, noun: keyof typeof ENGLISH.common.counts): string {
  return text(`common.counts.${noun}`, { count });
}
