import { useId } from "react";

export type IdentityGlyphKind = "owner" | "role" | "bot" | "artist" | "bug-hunter" | "community";

/** Meldiq's community emblems share a faceted silhouette, inset detail and the surrounding theme's ink. */
export function IdentityGlyph({ kind, size = 20 }: { kind: IdentityGlyphKind; size?: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`identity-glyph identity-glyph-${kind}`}>
      <defs>
        <linearGradient id={id} x1="5" y1="2" x2="20" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="currentColor" stopOpacity=".3" />
          <stop offset="1" stopColor="currentColor" stopOpacity=".06" />
        </linearGradient>
      </defs>
      {kind === "bot" ? (
        <>
          <path d="M5 7h14l2 3v8l-3 3H6l-3-3v-8l2-3Z" fill={`url(#${id})`} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M12 7V4m-5 9v2m10-2v2m-8 3h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="12" cy="2.8" r="1.4" fill="currentColor" />
        </>
      ) : kind === "community" ? (
        <>
          <path d="m12 2 9 5v10l-9 5-9-5V7l9-5Z" fill={`url(#${id})`} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="m7 15 2-6 3 4 3-4 2 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <path d="m12 1.5 8.5 4v7c0 5-4.5 8.1-8.5 10-4-1.9-8.5-5-8.5-10v-7l8.5-4Z" fill={`url(#${id})`} stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="m6 6.8 6-2.9 6 2.9" stroke="currentColor" strokeOpacity=".45" strokeWidth=".8" strokeLinecap="round" />
          {kind === "owner" && <path d="m6.5 9 1.3 6h8.4l1.3-6-3.2 2L12 7.5 9.7 11 6.5 9Zm1.8 8h7.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />}
          {kind === "role" && <path d="m12 7 4 5-4 5-4-5 4-5Z" fill="currentColor" />}
          {kind === "artist" && (
            <>
              <path d="m12 7 4.5 8-4.5 3-4.5-3L12 7Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
              <path d="M12 8v5" stroke="currentColor" strokeWidth="1.3" />
              <circle cx="12" cy="14" r="1.2" fill="currentColor" />
            </>
          )}
          {kind === "bug-hunter" && (
            <>
              <path d="M9 11a3 3 0 0 1 6 0v3a3 3 0 0 1-6 0v-3Zm3 0v6M9.5 8 8 6.5M14.5 8 16 6.5M6.5 11H9m6 0h2.5M6.5 15H9m6 0h2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </>
          )}
        </>
      )}
    </svg>
  );
}
