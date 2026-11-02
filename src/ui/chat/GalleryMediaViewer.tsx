import { useState, type ReactNode } from "react";
import type { GalleryItem } from "./gallery";
import { MediaViewer, OpenViewerContext, ViewerInfoContext } from "./MediaViewer";

/** Reuse one navigable viewer in the details grid and bulk-save dialog. */
export function GalleryMediaViewer({ items, nameOf, selecting = false, children }: { items: GalleryItem[]; nameOf: (i: GalleryItem) => string; selecting?: boolean; children: ReactNode }) {
  const [selected, setSelected] = useState<string | null>(null);
  const at = items.findIndex((i) => i.ref.id === selected);
  const current = items[at];
  return (
    <ViewerInfoContext.Provider value={current ? { sender: nameOf(current), at: current.at, text: "", quick: [], reacted: [], onReact: null } : null}>
      <OpenViewerContext.Provider
        value={(r) => {
          if (!selecting) setSelected(r.id);
        }}
      >
        {children}
        {current && <MediaViewer items={items.map((i) => i.ref)} at={at} onMove={(i) => setSelected(items[i].ref.id)} onClose={() => setSelected(null)} />}
      </OpenViewerContext.Provider>
    </ViewerInfoContext.Provider>
  );
}
