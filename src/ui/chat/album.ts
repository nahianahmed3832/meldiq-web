/** How an album of photos is laid out in a message (android Album, unit-tested like AttachmentPolicyTest). */

/** Rows of tile indexes: 2 → one row of two; 3 → one wide, then two; 4 or more → two rows of two. */
export function albumRows(count: number): number[][] {
  if (count <= 0) return [];
  if (count === 1) return [[0]];
  if (count === 2) return [[0, 1]];
  if (count === 3) return [[0], [1, 2]];
  return [
    [0, 1],
    [2, 3],
  ];
}

/** How many more than the grid shows ("+N" on the last tile). */
export const albumOverflow = (count: number): number => Math.max(0, count - 4);
