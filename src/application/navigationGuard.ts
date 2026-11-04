/** Unsaved editors register independently, so saving one card never clears another card's draft. */
const editors = new Set<symbol>();
const listeners = new Set<() => void>();
let pending: (() => void) | null = null;
let bypass = false;
const emit = () => listeners.forEach((listener) => listener());
export const hasUnsavedChanges = () => editors.size > 0;
export const pendingNavigation = () => pending !== null;
export function subscribeNavigationGuard(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function registerUnsavedEditor(): () => void {
  const token = Symbol();
  editors.add(token);
  return () => {
    editors.delete(token);
  };
}
export function requestNavigation(action: () => void): void {
  if (bypass || !editors.size) return action();
  pending = action;
  emit();
}
export function cancelNavigation(): void {
  pending = null;
  emit();
}
export function discardAndNavigate(): void {
  const action = pending;
  pending = null;
  // The destination unmounts the old editors. The bypass lasts only for this confirmed action.
  bypass = true;
  try {
    action?.();
  } finally {
    bypass = false;
    emit();
  }
}
