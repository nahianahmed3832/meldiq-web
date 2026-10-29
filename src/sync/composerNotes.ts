import { useSyncExternalStore } from "react";

/**
 * The latest refusal to explain above a conversation's composer (community parity A: content rules, the lock, the
 * verification level, onboarding). Kept in memory for this tab; sending again or closing the note clears it.
 */
export interface ComposerNote {
  text: string;
  at: number;
}

let notes: Readonly<Record<string, ComposerNote>> = {};
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function setComposerNote(conversationId: string, text: string, at = Date.now()): void {
  notes = { ...notes, [conversationId]: { text, at } };
  emit();
}

export function clearComposerNote(conversationId: string): void {
  if (!notes[conversationId]) return;
  const { [conversationId]: _gone, ...rest } = notes;
  notes = rest;
  emit();
}

export function composerNote(conversationId: string): ComposerNote | null {
  return notes[conversationId] ?? null;
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useComposerNote(conversationId: string): ComposerNote | null {
  return useSyncExternalStore(
    subscribe,
    () => notes[conversationId] ?? null,
    () => null,
  );
}
