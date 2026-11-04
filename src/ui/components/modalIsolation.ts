const original = new Map<HTMLElement, boolean>();

/** Isolate only the top modal branch, including nested portals; restore pre-existing inert state exactly. */
export function isolateTopModal(element: HTMLElement | undefined): void {
  // A closing submenu may already have had its parent released by React.
  for (const [outside, inert] of original) if (outside.inert) outside.inert = inert;
  original.clear();
  if (!element) return;
  let branch = element;
  while (branch.parentElement) {
    const parent = branch.parentElement;
    for (const sibling of parent.children) {
      if (sibling === branch || !(sibling instanceof HTMLElement) || ["SCRIPT", "STYLE", "LINK"].includes(sibling.tagName)) continue;
      original.set(sibling, sibling.inert);
      sibling.inert = true;
    }
    if (parent === document.body) break;
    branch = parent;
  }
}
