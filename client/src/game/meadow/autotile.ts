// The 47-piece "blob" layout that every terrain block in TilesetFloor.png shares.
// A block is an island material drawn on a base material. For one island tile the
// mask says which sides touch the base (edges) and which diagonals do while both
// neighbouring sides are still island (inner corners).
export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;
export const NE = 16;
export const SE = 32;
export const SW = 64;
export const NW = 128;

export type Cell = readonly [col: number, row: number];

const PIECES: ReadonlyArray<readonly [mask: number, col: number, row: number]> = [
  [0, 1, 1],
  [N, 1, 0],
  [E, 2, 1],
  [S, 1, 2],
  [W, 0, 1],
  [N | E, 2, 0],
  [N | W, 0, 0],
  [S | E, 2, 2],
  [S | W, 0, 2],
  [N | S, 1, 3],
  [E | W, 3, 1],
  [N | E | W, 3, 0],
  [S | E | W, 3, 2],
  [N | S | W, 0, 3],
  [N | S | E, 2, 3],
  [N | E | S | W, 3, 3],
  [N | W | SE, 4, 0],
  [N | SE, 5, 0],
  [N | SW, 6, 0],
  [N | E | SW, 7, 0],
  [N | SW | SE, 8, 0],
  [NE | SW, 9, 0],
  [W | SE, 4, 1],
  [SE, 5, 1],
  [SW, 6, 1],
  [E | SW, 7, 1],
  [SW | SE, 8, 1],
  [NW | SE, 9, 1],
  [W | NE, 4, 2],
  [NE, 5, 2],
  [NW, 6, 2],
  [E | NW, 7, 2],
  [NW | NE, 8, 2],
  [NW | NE | SW, 9, 2],
  [NW | NE | SE, 10, 2],
  [S | W | NE, 4, 3],
  [S | NE, 5, 3],
  [S | NW, 6, 3],
  [S | E | NW, 7, 3],
  [S | NW | NE, 8, 3],
  [NW | SW | SE, 9, 3],
  [NE | SW | SE, 10, 3],
  [W | NE | SE, 4, 4],
  [NE | SE, 5, 4],
  [NW | SW, 6, 4],
  [E | NW | SW, 7, 4],
  [NE | SE | SW | NW, 8, 4],
];

const BY_MASK = new Map<number, Cell>(PIECES.map(([mask, col, row]) => [mask, [col, row]]));

export const PIECE_COUNT = PIECES.length;

/** `island(col,row)` answers for any cell, on or off the map. */
export function blobMask(island: (col: number, row: number) => boolean, col: number, row: number): number {
  const n = !island(col, row - 1);
  const e = !island(col + 1, row);
  const s = !island(col, row + 1);
  const w = !island(col - 1, row);
  let mask = (n ? N : 0) | (e ? E : 0) | (s ? S : 0) | (w ? W : 0);
  if (!n && !e && !island(col + 1, row - 1)) mask |= NE;
  if (!s && !e && !island(col + 1, row + 1)) mask |= SE;
  if (!s && !w && !island(col - 1, row + 1)) mask |= SW;
  if (!n && !w && !island(col - 1, row - 1)) mask |= NW;
  return mask;
}

/** The piece inside a block for a mask, as [col,row] from the block's top-left tile. */
export function blobPiece(mask: number): Cell {
  const piece = BY_MASK.get(mask);
  if (!piece) throw new Error(`no terrain piece for mask ${mask}`);
  return piece;
}
