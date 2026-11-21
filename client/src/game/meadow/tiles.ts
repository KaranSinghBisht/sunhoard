// Which 16-px tile of TilesetFloor.png each map cell shows. Cells are [col,row] on the sheet.
import { blobMask, blobPiece, type Cell } from "./autotile";
import { chance, isDrift, isPond, isRoad } from "./layout";

/** Top-left tile of each terrain block on the sheet. */
const SNOW: Cell = [0, 14]; // white drift on trodden snow
const GRASS: Cell = [11, 7]; // dirt on grass: the thaw
const ICE: Cell = [0, 21]; // ice on white snow

const FLAT_ROW = 5;
const ALL_SIDES = 15;

function within(block: Cell, col: number, row: number): Cell {
  return [block[0] + col, block[1] + row];
}

/** The plain base tile, or one of its four scuffed variants. */
function base(block: Cell, col: number, row: number, scuffed: number): Cell {
  const roll = chance(col, row, 11);
  if (roll >= scuffed) return within(block, 0, FLAT_ROW);
  return within(block, 1 + Math.floor((roll / scuffed) * 4), FLAT_ROW);
}

/** The plain island tile, now and then with a twig or a pebble on it. */
function middle(block: Cell, col: number, row: number, marked: number): Cell {
  const roll = chance(col, row, 23);
  if (roll >= marked) return within(block, 1, 1);
  return within(block, roll < marked / 2 ? 0 : 1, 4);
}

function island(block: Cell, test: (col: number, row: number) => boolean, col: number, row: number, marked: number): Cell {
  const mask = blobMask(test, col, row);
  if (mask === 0) return middle(block, col, row, marked);
  const [pieceCol, pieceRow] = blobPiece(mask);
  return within(block, pieceCol, pieceRow);
}

/** Winter: deep white drifts everywhere, with the road and the yards trodden flat. */
export function winterTile(col: number, row: number): Cell {
  if (!isDrift(col, row)) return base(SNOW, col, row, 0.3);
  return island(SNOW, isDrift, col, row, 0.04);
}

/** The thaw under a lit lantern: grass, with the road showing as bare earth. */
export function thawTile(col: number, row: number): Cell {
  if (!isRoad(col, row)) return base(GRASS, col, row, 0.4);
  return island(GRASS, isRoad, col, row, 0.08);
}

/** The pond's ice, drawn over the white drift. Null where there is no pond. */
export function pondTile(col: number, row: number): Cell | null {
  if (!isPond(col, row)) return null;
  const mask = blobMask(isPond, col, row);
  // The ice block has no lone-tile piece; a one-tile pond shows plain ice.
  if (mask === 0 || mask === ALL_SIDES) return within(ICE, 1, 1);
  const [pieceCol, pieceRow] = blobPiece(mask);
  return within(ICE, pieceCol, pieceRow);
}
