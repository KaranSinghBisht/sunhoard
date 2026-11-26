// Lantern Meadow, drawn by hand. One character is one 16-px tile.
//   #  birchwood (solid, filled with trees)     .  open snow field
//   =  the road                                  ,  trodden ground (camp, yards)
//   ~  the frozen pond (solid)
import { GATHER_TILES } from "../../gen/economy";

const ROWS_TEXT = [
  "############################################################",
  "############################################################",
  "############################################################",
  "################......######...#############################",
  "####........####.......##........######....#################",
  "####..............................,,.......#################",
  "###......~~~~..................,,,,,,,,....#################",
  "###....~~~~~~~~...............,,,,,,,,,,...#################",
  "####..~~~~~~~~~~..............,,,,,,,,,,...#################",
  "####..~~~~~~~~~~...........###,,,,==,,,,...#################",
  "####...~~~~~~~~..######..#######,,==,,.....#################",
  "###......~~~~....######..#######..==........################",
  "###..............######....###....==..........##############",
  "###...............................==..................######",
  "###........###......,,,,,,,,......==....######........######",
  "#####....#######..,,,,,,,,,,,,....==....######..........####",
  "######...#######..,,,,,,,,,,,,....==....######...........###",
  "######.....###...,,,,,,,,,,,,,,...==...............,,,...###",
  "######............,,,,,,,,,,,,....==..............,,,,,..###",
  "#####..............,,,,,,,,,,.....==.............,,,,,,,.###",
  "======================================================,,####",
  "======================================================..####",
  "#####..................==...............................####",
  "#####..................==...............................####",
  "##################.....==..........#####................####",
  "##################.....==........#########....######....####",
  "##################.....==........###########################",
  "##############.........==........###########################",
  "##############.........==.........##########################",
  "##############.....,,,,==,,,,............###################",
  "##############...,,,,,,==,,,,,,..........###################",
  "##############...,,,,,,==,,,,,,..........###################",
  "##############...,,,,,,,,,,,,,,..........###################",
  "#############.....,,,,,,,,,,,,...........###################",
  "##############......,,,,,,,,.............###################",
  "################........................####################",
  "#####################..........#############################",
  "############################################################",
  "############################################################",
  "############################################################",
];

export type Ground = "#" | "." | "=" | "," | "~";

export const TILE = 16;
export const COLS = ROWS_TEXT[0].length;
export const ROWS = ROWS_TEXT.length;
export const MAP_W = COLS * TILE;
export const MAP_H = ROWS * TILE;

/** The birch the keeper chops: its trunk stands on this tile. */
export const [BIRCH_COL, BIRCH_ROW] = GATHER_TILES[0];
export const TREE_X = BIRCH_COL * TILE + 8;
export const TREE_Y = (BIRCH_ROW + 1) * TILE;
export const START_X = 22 * TILE + 8;
export const START_Y = 19 * TILE + 8;

export function rowsText(): readonly string[] {
  return ROWS_TEXT;
}

/** Off-map cells repeat the nearest edge tile, so the road runs off the map instead of stopping. */
export function groundAt(col: number, row: number): Ground {
  const c = Math.max(0, Math.min(COLS - 1, col));
  const r = Math.max(0, Math.min(ROWS - 1, row));
  return ROWS_TEXT[r][c] as Ground;
}

export function onMap(col: number, row: number): boolean {
  return col >= 0 && row >= 0 && col < COLS && row < ROWS;
}

/** A stable 0..1 number per tile, for picking variants without Math.random. */
export function chance(col: number, row: number, salt: number): number {
  let h = Math.imul(col + 374761393, 668265263) ^ Math.imul(row + 1274126177, 2246822519) ^ Math.imul(salt + 1, 3266489917);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function isRoad(col: number, row: number): boolean {
  return groundAt(col, row) === "=";
}

export function isPond(col: number, row: number): boolean {
  return groundAt(col, row) === "~";
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Soft value noise over the tile grid: neighbouring tiles get neighbouring numbers. */
function drift(col: number, row: number, size: number, salt: number): number {
  const x = col / size;
  const y = row / size;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const top = chance(x0, y0, salt) * (1 - fx) + chance(x0 + 1, y0, salt) * fx;
  const bottom = chance(x0, y0 + 1, salt) * (1 - fx) + chance(x0 + 1, y0 + 1, salt) * fx;
  return top * (1 - fy) + bottom * fy;
}

const BARE_ABOVE = 0.6;

function nearPond(col: number, row: number): boolean {
  for (let r = row - 1; r <= row + 1; r += 1) {
    for (let c = col - 1; c <= col + 1; c += 1) if (groundAt(c, r) === "~") return true;
  }
  return false;
}

/** Wind-scoured patches in the open fields, where the snow lies thin: they break up the white. */
export function isBare(col: number, row: number): boolean {
  if (groundAt(col, row) !== "." || nearPond(col, row)) return false;
  return drift(col, row, 2.7, 61) * 0.65 + drift(col, row, 6.3, 67) * 0.35 > BARE_ABOVE;
}

/** Deep snow: everything that is not road, trodden ground or a scoured patch. */
export function isDrift(col: number, row: number): boolean {
  const ground = groundAt(col, row);
  return ground !== "=" && ground !== "," && !isBare(col, row);
}

export function isOpenSnow(col: number, row: number): boolean {
  return groundAt(col, row) === ".";
}
